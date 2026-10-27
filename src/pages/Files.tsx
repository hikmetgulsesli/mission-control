import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { GlitchText } from "../components/GlitchText";
import { FileTree } from "../components/FileTree";
import { FileViewer } from "../components/FileViewer";
import { ContextMenu } from "../components/ContextMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { usePolling } from "../hooks/usePolling";

type DialogState =
  | null
  | { type: "delete"; path: string; name: string; isDir: boolean }
  | { type: "rename"; path: string; name: string }
  | { type: "newFile"; dir: string }
  | { type: "newDir"; dir: string }
  | { type: "upload"; dir: string };

type CtxTarget = { path: string; name: string; isDir: boolean } | null;

export function Files() {
  const { toast } = useToast();
  const [currentPath, setCurrentPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: CtxTarget } | null>(null);

  // Dialog
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogInput, setDialogInput] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState("");

  // Upload ref
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Unsaved changes confirmation
  const [unsavedConfirm, setUnsavedConfirm] = useState<{ action: () => void | Promise<void> } | null>(null);
  const mountedRef = useRef(false);
  // Identity, rather than path equality, distinguishes A → B → A selections.
  const selectionRef = useRef(0);
  const editRef = useRef({ active: false, revision: 0 });
  const saveRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      selectionRef.current++;
    };
  }, []);

  const ownsSelection = (owner: number) => mountedRef.current && selectionRef.current === owner;

  const replaceSelection = (path: string | null, keepEdit = false) => {
    const owner = ++selectionRef.current;
    editRef.current.revision++;
    setSelectedFile(path);
    setFileData(null);
    setFileError(null);
    setFileLoading(false);
    setSaving(false);
    if (!keepEdit) {
      editRef.current.active = false;
      setEditMode(false);
      setEditContent("");
      setOriginalContent("");
    }
    return owner;
  };

  const { data: listing, error: listError, loading: listLoading, refresh } = usePolling(() => api.filesList(currentPath), 30000, currentPath);

  useEffect(() => {
    if (!currentPath && listing?.path) setCurrentPath(listing.path);
  }, [currentPath, listing?.path]);

  const confirmIfUnsaved = (action: () => void | Promise<void>) => {
    // Async follow-ups must consult the current edit session, not their render closure.
    if (editRef.current.active) {
      setUnsavedConfirm({ action });
      return;
    }
    return action();
  };

  const handleNavigate = (path: string) => {
    confirmIfUnsaved(() => {
      replaceSelection(null);
      setCurrentPath(path);
    });
  };

  const handleSelectFile = async (path: string, editIntent = false) => {
    const doSelect = async () => {
      if (!mountedRef.current) return;
      const owner = replaceSelection(path);
      setFileLoading(true);
      try {
        const data = await api.filesRead(path);
        if (!ownsSelection(owner)) return;
        setFileData(data);
        if (editIntent) {
          editRef.current.revision++;
          editRef.current.active = true;
          setOriginalContent(data.content);
          setEditContent(data.content);
          setEditMode(true);
        }
      } catch (err: any) {
        if (!ownsSelection(owner)) return;
        setFileError(err.message || "Failed to read file");
        setFileData(null);
      } finally {
        if (ownsSelection(owner)) setFileLoading(false);
      }
    };
    return confirmIfUnsaved(doSelect);
  };

  // Edit handlers
  const handleStartEdit = () => {
    if (!fileData) return;
    editRef.current.revision++;
    editRef.current.active = true;
    setOriginalContent(fileData.content);
    setEditContent(fileData.content);
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!fileData || !selectedFile) return;
    const owner = selectionRef.current;
    const revision = editRef.current.revision;
    const save = ++saveRef.current;
    const ownsSave = () => ownsSelection(owner) && saveRef.current === save;
    const ownsDraft = () => ownsSave() && editRef.current.revision === revision;
    const path = selectedFile;
    setSaving(true);
    try {
      await api.filesWrite(path, editContent);
      if (!ownsDraft()) return;
      const updated = await api.filesRead(path);
      if (!ownsDraft()) return;
      setFileData(updated);
      setOriginalContent(updated.content);
      editRef.current.revision++;
      editRef.current.active = false;
      setEditMode(false);
      refresh();
    } catch (err: any) {
      if (mountedRef.current) toast("Save failed: " + (err.message || "Unknown error"), "error");
    } finally {
      // Losing the draft still settles this save; a newer save owns its own indicator.
      if (ownsSave()) setSaving(false);
    }
  };

  const handleCancel = () => {
    editRef.current.revision++;
    editRef.current.active = false;
    setEditMode(false);
    setEditContent("");
  };

  const handleUndo = () => {
    editRef.current.revision++;
    setEditContent(originalContent);
  };

  const handleEditChange = (content: string) => {
    editRef.current.revision++;
    setEditContent(content);
  };

  const handleDownload = () => {
    if (!selectedFile) return;
    window.open("/api/files/download?path=" + encodeURIComponent(selectedFile), "_blank");
  };

  // Context menu
  const handleContextMenu = (x: number, y: number, target: CtxTarget) => {
    setCtxMenu({ x, y, target });
  };

  const getContextMenuItems = () => {
    if (!ctxMenu) return [];
    const t = ctxMenu.target;

    if (!t) {
      return [
        { label: "New File", icon: "+", action: () => openDialog("newFile") },
        { label: "New Directory", icon: ">", action: () => openDialog("newDir") },
        { label: "Upload", icon: "^", action: () => openDialog("upload") },
      ];
    }

    if (t.isDir) {
      return [
        { label: "Open", icon: ">", action: () => handleNavigate(t.path + "/") },
        { label: "New File", icon: "+", action: () => confirmIfUnsaved(() => { replaceSelection(null); setCurrentPath(t.path + "/"); openDialog("newFile", t.path + "/"); }) },
        { label: "New Directory", icon: ">", action: () => openDialog("newDir", t.path + "/") },
        { label: "Upload", icon: "^", action: () => openDialog("upload", t.path + "/") },
        { label: "Rename", icon: "R", action: () => { setDialog({ type: "rename", path: t.path, name: t.name }); setDialogInput(t.name); } },
        { label: "Delete", icon: "X", action: () => setDialog({ type: "delete", path: t.path, name: t.name, isDir: true }), danger: true },
      ];
    }

    return [
      { label: "Edit", icon: "E", action: () => handleSelectFile(t.path, true) },
      { label: "Rename", icon: "R", action: () => { setDialog({ type: "rename", path: t.path, name: t.name }); setDialogInput(t.name); } },
      { label: "Download", icon: "D", action: () => window.open("/api/files/download?path=" + encodeURIComponent(t.path), "_blank") },
      { label: "Delete", icon: "X", action: () => setDialog({ type: "delete", path: t.path, name: t.name, isDir: false }), danger: true },
    ];
  };

  // Dialog helpers
  const openDialog = (type: "newFile" | "newDir" | "upload", dir?: string) => {
    setDialog({ type, dir: dir || currentPath });
    setDialogInput("");
    setDialogError("");
    setUploadFile(null);
  };

  const closeDialog = () => {
    setDialog(null);
    setDialogInput("");
    setDialogError("");
    setDialogLoading(false);
    setUploadFile(null);
  };

  // Action handlers
  const handleDelete = async () => {
    if (!dialog || dialog.type !== "delete") return;
    const owner = selectionRef.current;
    const revision = editRef.current.revision;
    setDialogLoading(true);
    setDialogError("");
    try {
      await api.filesDelete(dialog.path);
      if (!mountedRef.current) return;
      if (ownsSelection(owner) && editRef.current.revision === revision && selectedFile === dialog.path) {
        replaceSelection(null);
      }
      refresh();
      closeDialog();
    } catch (err: any) {
      if (mountedRef.current) setDialogError(err.message || "Delete failed");
    } finally {
      if (mountedRef.current) setDialogLoading(false);
    }
  };

  const handleRename = async () => {
    if (!dialog || dialog.type !== "rename") return;
    if (!dialogInput.trim()) { setDialogError("Name cannot be empty"); return; }
    const owner = selectionRef.current;
    let readOwner: number | undefined;
    setDialogLoading(true);
    setDialogError("");
    try {
      const dir = dialog.path.substring(0, dialog.path.lastIndexOf("/"));
      const newPath = dir + "/" + dialogInput.trim();
      await api.filesRename(dialog.path, newPath);
      if (!mountedRef.current) return;
      if (ownsSelection(owner) && selectedFile === dialog.path) {
        readOwner = replaceSelection(newPath, true);
        setFileLoading(true);
        const data = await api.filesRead(newPath);
        if (ownsSelection(readOwner)) setFileData(data);
      }
      if (!mountedRef.current) return;
      refresh();
      closeDialog();
    } catch (err: any) {
      if (mountedRef.current) setDialogError(err.message || "Rename failed");
    } finally {
      if (readOwner !== undefined && ownsSelection(readOwner)) setFileLoading(false);
      if (mountedRef.current) setDialogLoading(false);
    }
  };

  const handleNewFile = async () => {
    if (!dialog || dialog.type !== "newFile") return;
    if (!dialogInput.trim()) { setDialogError("File name cannot be empty"); return; }
    const owner = selectionRef.current;
    const revision = editRef.current.revision;
    setDialogLoading(true);
    setDialogError("");
    try {
      const filePath = dialog.dir.endsWith("/") ? dialog.dir + dialogInput.trim() : dialog.dir + "/" + dialogInput.trim();
      await api.filesWrite(filePath, "");
      if (!mountedRef.current) return;
      refresh();
      closeDialog();
      if (ownsSelection(owner) && editRef.current.revision === revision) await handleSelectFile(filePath, true);
    } catch (err: any) {
      if (mountedRef.current) {
        setDialogError(err.message || "File creation failed");
        setDialogLoading(false);
      }
    }
  };

  const handleMkdir = async () => {
    if (!dialog || dialog.type !== "newDir") return;
    if (!dialogInput.trim()) { setDialogError("Directory name cannot be empty"); return; }
    setDialogLoading(true);
    setDialogError("");
    try {
      const dirPath = dialog.dir.endsWith("/") ? dialog.dir + dialogInput.trim() : dialog.dir + "/" + dialogInput.trim();
      await api.filesMkdir(dirPath);
      refresh();
      closeDialog();
    } catch (err: any) {
      setDialogError(err.message || "Directory creation failed");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!dialog || dialog.type !== "upload" || !uploadFile) return;
    setDialogLoading(true);
    setDialogError("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.split(",")[1] || "";
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });
      await api.filesUpload(dialog.dir, uploadFile.name, base64);
      refresh();
      closeDialog();
    } catch (err: any) {
      setDialogError(err.message || "Upload failed");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);
    setDialogError("");
  };

  // Build breadcrumb segments
  const pathParts = currentPath.split("/").filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part,
    path: "/" + pathParts.slice(0, i + 1).join("/") + "/",
  }));

  const hasChanges = editContent !== originalContent;

  return (
    <div className="files-page">
      <div className="files-page__top">
        <GlitchText text="FILES" tag="h2" />
        <button className="files-refresh-btn" onClick={refresh} title="Refresh">
          REFRESH
        </button>
      </div>
      <div className="files-breadcrumb">
        <button className="files-breadcrumb__seg" onClick={() => handleNavigate("/")}>
          /
        </button>
        {breadcrumbs.map((bc) => (
          <button
            key={bc.path}
            className={`files-breadcrumb__seg ${bc.path === currentPath ? "files-breadcrumb__seg--active" : ""}`}
            onClick={() => handleNavigate(bc.path)}
          >
            {bc.label} /
          </button>
        ))}
      </div>
      <div className="files-page__panels">
        <div className="files-page__tree">
          {listLoading && !listing ? (
            <div className="file-tree__empty">Loading...</div>
          ) : listError ? (
            <div className="file-tree__empty file-tree__empty--error">{listError}</div>
          ) : (
            <FileTree
              entries={listing?.entries || []}
              currentPath={currentPath}
              selectedFile={selectedFile}
              onNavigate={handleNavigate}
              onSelectFile={handleSelectFile}
              onContextMenu={handleContextMenu}
              onNewFile={() => openDialog("newFile")}
              onNewDir={() => openDialog("newDir")}
              onUpload={() => openDialog("upload")}
            />
          )}
        </div>
        <div className="files-page__viewer">
          <FileViewer
            file={fileData}
            loading={fileLoading}
            error={fileError}
            editMode={editMode}
            editContent={editContent}
            onEditChange={handleEditChange}
            onSave={handleSave}
            onCancel={handleCancel}
            onUndo={handleUndo}
            onStartEdit={handleStartEdit}
            onDownload={selectedFile ? handleDownload : undefined}
            saving={saving}
            hasChanges={hasChanges}
          />
        </div>
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={getContextMenuItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Unsaved changes confirmation */}
      <ConfirmDialog
        open={!!unsavedConfirm}
        title="Unsaved Changes"
        message="There are unsaved changes. Do you want to continue?"
        confirmLabel="Continue"
        onConfirm={() => {
          const action = unsavedConfirm?.action;
          setUnsavedConfirm(null);
          if (action) action();
        }}
        onCancel={() => setUnsavedConfirm(null)}
      />

      {/* Dialogs */}
      {dialog && (
        <div className="file-dialog__backdrop" onClick={closeDialog}>
          <div className="file-dialog" onClick={(e) => e.stopPropagation()}>
            {dialog.type === "delete" && (
              <>
                <h3 className="file-dialog__title">Delete Confirmation</h3>
                <p className="file-dialog__text">
                  <strong>{dialog.name}</strong> {dialog.isDir ? "directory and all contents" : "file"} will be deleted. Are you sure?
                </p>
                {dialogError && <p className="file-dialog__error">{dialogError}</p>}
                <div className="file-dialog__actions">
                  <button className="file-dialog__btn file-dialog__btn--danger" onClick={handleDelete} disabled={dialogLoading}>
                    {dialogLoading ? "Deleting..." : "Delete"}
                  </button>
                  <button className="file-dialog__btn" onClick={closeDialog}>Cancel</button>
                </div>
              </>
            )}
            {dialog.type === "rename" && (
              <>
                <h3 className="file-dialog__title">Rename</h3>
                <input
                  className="file-dialog__input"
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  autoFocus
                  placeholder="New name"
                />
                {dialogError && <p className="file-dialog__error">{dialogError}</p>}
                <div className="file-dialog__actions">
                  <button className="file-dialog__btn file-dialog__btn--save" onClick={handleRename} disabled={dialogLoading}>
                    {dialogLoading ? "Saving..." : "Save"}
                  </button>
                  <button className="file-dialog__btn" onClick={closeDialog}>Cancel</button>
                </div>
              </>
            )}
            {dialog.type === "newFile" && (
              <>
                <h3 className="file-dialog__title">New File</h3>
                <p className="file-dialog__text file-dialog__text--dim">{dialog.dir}</p>
                <input
                  className="file-dialog__input"
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNewFile()}
                  autoFocus
                  placeholder="File name"
                />
                {dialogError && <p className="file-dialog__error">{dialogError}</p>}
                <div className="file-dialog__actions">
                  <button className="file-dialog__btn file-dialog__btn--save" onClick={handleNewFile} disabled={dialogLoading}>
                    {dialogLoading ? "Creating..." : "Create"}
                  </button>
                  <button className="file-dialog__btn" onClick={closeDialog}>Cancel</button>
                </div>
              </>
            )}
            {dialog.type === "newDir" && (
              <>
                <h3 className="file-dialog__title">New Directory</h3>
                <p className="file-dialog__text file-dialog__text--dim">{dialog.dir}</p>
                <input
                  className="file-dialog__input"
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMkdir()}
                  autoFocus
                  placeholder="Directory name"
                />
                {dialogError && <p className="file-dialog__error">{dialogError}</p>}
                <div className="file-dialog__actions">
                  <button className="file-dialog__btn file-dialog__btn--save" onClick={handleMkdir} disabled={dialogLoading}>
                    {dialogLoading ? "Creating..." : "Create"}
                  </button>
                  <button className="file-dialog__btn" onClick={closeDialog}>Cancel</button>
                </div>
              </>
            )}
            {dialog.type === "upload" && (
              <>
                <h3 className="file-dialog__title">Upload File</h3>
                <p className="file-dialog__text file-dialog__text--dim">{dialog.dir}</p>
                <input
                  ref={uploadRef}
                  type="file"
                  className="file-dialog__file-input"
                  onChange={handleFileInputChange}
                />
                {uploadFile && (
                  <p className="file-dialog__text">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</p>
                )}
                {dialogError && <p className="file-dialog__error">{dialogError}</p>}
                <div className="file-dialog__actions">
                  <button className="file-dialog__btn file-dialog__btn--save" onClick={handleUpload} disabled={dialogLoading || !uploadFile}>
                    {dialogLoading ? "Uploading..." : "Upload"}
                  </button>
                  <button className="file-dialog__btn" onClick={closeDialog}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
