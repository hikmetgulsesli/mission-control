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
  const [unsavedConfirm, setUnsavedConfirm] = useState<{ action: () => void } | null>(null);

  const { data: listing, error: listError, loading: listLoading, refresh } = usePolling(() => api.filesList(currentPath), 30000, currentPath);

  useEffect(() => {
    if (!currentPath && listing?.path) setCurrentPath(listing.path);
  }, [currentPath, listing?.path]);

  const confirmIfUnsaved = (action: () => void) => {
    if (editMode) {
      setUnsavedConfirm({ action });
      return;
    }
    action();
  };

  const handleNavigate = (path: string) => {
    confirmIfUnsaved(() => {
      setEditMode(false);
      setCurrentPath(path);
      setSelectedFile(null);
      setFileData(null);
      setFileError(null);
    });
  };

  const handleSelectFile = async (path: string) => {
    const doSelect = async () => {
      setEditMode(false);
      setSelectedFile(path);
      setFileLoading(true);
      setFileError(null);
      try {
        const data = await api.filesRead(path);
        setFileData(data);
      } catch (err: any) {
        setFileError(err.message || "Failed to read file");
        setFileData(null);
      } finally {
        setFileLoading(false);
      }
    };
    confirmIfUnsaved(doSelect);
  };

  // Edit handlers
  const handleStartEdit = () => {
    if (!fileData) return;
    setOriginalContent(fileData.content);
    setEditContent(fileData.content);
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!fileData || !selectedFile) return;
    setSaving(true);
    try {
      await api.filesWrite(selectedFile, editContent);
      const updated = await api.filesRead(selectedFile);
      setFileData(updated);
      setOriginalContent(updated.content);
      setEditMode(false);
      refresh();
    } catch (err: any) {
      toast("Save failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditContent("");
  };

  const handleUndo = () => {
    setEditContent(originalContent);
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
        { label: "New File", icon: "+", action: () => { setCurrentPath(t.path + "/"); openDialog("newFile", t.path + "/"); } },
        { label: "New Directory", icon: ">", action: () => openDialog("newDir", t.path + "/") },
        { label: "Upload", icon: "^", action: () => openDialog("upload", t.path + "/") },
        { label: "Rename", icon: "R", action: () => { setDialog({ type: "rename", path: t.path, name: t.name }); setDialogInput(t.name); } },
        { label: "Delete", icon: "X", action: () => setDialog({ type: "delete", path: t.path, name: t.name, isDir: true }), danger: true },
      ];
    }

    return [
      { label: "Edit", icon: "E", action: () => { handleSelectFile(t.path).then(() => setTimeout(handleStartEdit, 100)); } },
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
    setDialogLoading(true);
    setDialogError("");
    try {
      await api.filesDelete(dialog.path);
      if (selectedFile === dialog.path) {
        setSelectedFile(null);
        setFileData(null);
        setEditMode(false);
      }
      refresh();
      closeDialog();
    } catch (err: any) {
      setDialogError(err.message || "Delete failed");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleRename = async () => {
    if (!dialog || dialog.type !== "rename") return;
    if (!dialogInput.trim()) { setDialogError("Name cannot be empty"); return; }
    setDialogLoading(true);
    setDialogError("");
    try {
      const dir = dialog.path.substring(0, dialog.path.lastIndexOf("/"));
      const newPath = dir + "/" + dialogInput.trim();
      await api.filesRename(dialog.path, newPath);
      if (selectedFile === dialog.path) {
        setSelectedFile(newPath);
        const data = await api.filesRead(newPath);
        setFileData(data);
      }
      refresh();
      closeDialog();
    } catch (err: any) {
      setDialogError(err.message || "Rename failed");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleNewFile = async () => {
    if (!dialog || dialog.type !== "newFile") return;
    if (!dialogInput.trim()) { setDialogError("File name cannot be empty"); return; }
    setDialogLoading(true);
    setDialogError("");
    try {
      const filePath = dialog.dir.endsWith("/") ? dialog.dir + dialogInput.trim() : dialog.dir + "/" + dialogInput.trim();
      await api.filesWrite(filePath, "");
      refresh();
      closeDialog();
      await handleSelectFile(filePath);
      setTimeout(handleStartEdit, 200);
    } catch (err: any) {
      setDialogError(err.message || "File creation failed");
      setDialogLoading(false);
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
            onEditChange={setEditContent}
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
