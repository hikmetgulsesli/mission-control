import { useState, useEffect, useCallback } from 'react';

interface Rule {
  id: string;
  title: string;
  content: string;
  category: string;
  project_type: string;
  severity: string;
  applies_to: string;
  source?: string;
  source_file?: string;
  readonly?: boolean;
  enabled?: boolean;
}

const STAGES = [
  { id: 'setup', label: 'SETUP', icon: '\u2699', color: '#f59e0b', desc: 'Repo init, DB provision, dependencies' },
  { id: 'design', label: 'DESIGN', icon: '\u25B3', color: '#a855f7', desc: 'UI contract, Stitch, design tokens' },
  { id: 'implement', label: 'IMPLEMENT', icon: '\u276F', color: '#3b82f6', desc: 'Coding, lint, build, story dev' },
  { id: 'verify', label: 'VERIFY', icon: '\u2713', color: '#10b981', desc: 'PR review, merge, browser test' },
] as const;

const CAT_COLORS: Record<string, string> = {
  design: '#a855f7', implementation: '#3b82f6', verification: '#10b981',
  setup: '#f59e0b', lint: '#ef4444', pipeline: '#6366f1', general: '#6b7280',
};

const CATEGORIES = ['design', 'implementation', 'verification', 'setup', 'lint', 'pipeline', 'general'] as const;
const PROJECT_TYPES = ['general', 'react', 'nextjs', 'mobile'] as const;
const SEVERITIES = ['mandatory', 'advisory', 'info'] as const;
const APPLIES_TO = ['implement', 'verify', 'setup', 'design', 'all'] as const;

export function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState<{ open: boolean; rule?: Rule }>({ open: false });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/rules');
      setRules(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getRulesForStage = (stageId: string) => {
    return rules.filter(r => r.applies_to === stageId || r.applies_to === 'all');
  };

  const getFilteredRules = () => {
    let list = activeStage ? getRulesForStage(activeStage) : rules;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(s) || r.content.toLowerCase().includes(s));
    }
    if (typeFilter) list = list.filter(r => r.project_type === typeFilter);
    return list;
  };

  const filtered = getFilteredRules();
  const toggle = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kurali silmek istediginize emin misiniz?')) return;
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    load();
  };

  const handleSave = async (data: any, id?: string) => {
    await fetch(id ? `/api/rules/${id}` : '/api/rules', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setModal({ open: false });
    load();
  };

  const handleExport = async () => {
    const res = await fetch('/api/rules/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'setfarm-rules.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const res = await fetch('/api/rules/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text,
      });
      const result = await res.json();
      alert(`Import: ${result.imported || 0} eklendi, ${result.updated || 0} guncellendi`);
      load();
    };
    input.click();
  };

  if (loading) return <div className="page-loading">Loading rules...</div>;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--neon-orange)', margin: 0, fontFamily: 'var(--font)' }}>
            Rules Engine
          </h1>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--font)' }}>
            {rules.length} kural &middot; {rules.filter(r => r.readonly).length} system &middot; {rules.filter(r => !r.readonly).length} custom
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={handleImport}>IMPORT</button>
          <button className="btn" onClick={handleExport}>EXPORT</button>
          <button className="btn btn--primary" onClick={() => setModal({ open: true })}>+ NEW RULE</button>
        </div>
      </div>

      {/* Pipeline Stage Selector */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
        overflow: 'hidden',
      }}>
        {/* ALL button */}
        <button
          onClick={() => setActiveStage(null)}
          style={{
            flex: 'none', padding: '14px 20px', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            background: activeStage === null ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: activeStage === null ? 'var(--text-primary)' : 'var(--text-dim)',
            borderRight: '1px solid var(--border)',
            transition: 'all 0.15s',
          }}
        >
          ALL ({rules.length})
        </button>

        {STAGES.map((stage, i) => {
          const count = getRulesForStage(stage.id).length;
          const isActive = activeStage === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(isActive ? null : stage.id)}
              style={{
                flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', position: 'relative',
                background: isActive ? `${stage.color}15` : 'transparent',
                borderBottom: isActive ? `2px solid ${stage.color}` : '2px solid transparent',
                borderRight: i < STAGES.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: isActive ? stage.color : 'var(--text-dim)' }}>{stage.icon}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  color: isActive ? stage.color : 'var(--text-dim)',
                  textTransform: 'uppercase',
                }}>{stage.label}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                  background: isActive ? `${stage.color}25` : 'rgba(255,255,255,0.05)',
                  color: isActive ? stage.color : 'var(--text-dim)',
                }}>{count}</span>
              </div>
              <div style={{
                fontSize: 9, color: 'var(--text-dim)', opacity: isActive ? 1 : 0.6,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>{stage.desc}</div>
              {/* Arrow connector */}
              {i < STAGES.length - 1 && (
                <div style={{
                  position: 'absolute', right: -7, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--border)', fontSize: 12, zIndex: 1,
                }}>&rsaquo;</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Active stage info banner */}
      {activeStage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
          padding: '8px 14px', borderRadius: 6,
          background: `${STAGES.find(s => s.id === activeStage)!.color}10`,
          border: `1px solid ${STAGES.find(s => s.id === activeStage)!.color}30`,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: STAGES.find(s => s.id === activeStage)!.color,
            fontFamily: 'var(--font)', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {STAGES.find(s => s.id === activeStage)!.icon} {activeStage} stage
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font)' }}>
            {filtered.length} kural aktif &middot; {filtered.filter(r => r.applies_to === 'all').length} global
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <input
              type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              style={{
                padding: '4px 10px', fontSize: 11, width: 160,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 4,
                fontFamily: 'var(--font)', outline: 'none',
              }}
            />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{
              padding: '4px 8px', fontSize: 11, background: 'var(--bg-input)',
              color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4,
              fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer',
            }}>
              <option value="">All Types</option>
              {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Filters when no stage selected */}
      {!activeStage && (
        <div style={{
          display: 'flex', gap: 10, marginBottom: 14, padding: '8px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6,
        }}>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 160, padding: '6px 10px', fontSize: 11,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4,
              fontFamily: 'var(--font)', outline: 'none',
            }}
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
            <option value="">All Types</option>
            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* Rules list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(r => {
          const isExpanded = expanded.has(r.id);
          const catColor = CAT_COLORS[r.category] || '#6b7280';
          const isGlobal = r.applies_to === 'all';

          return (
            <div key={r.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${catColor}`, borderRadius: 4,
              opacity: r.enabled === false ? 0.35 : 1, transition: 'all 0.15s',
            }}>
              <div onClick={() => toggle(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                cursor: 'pointer', userSelect: 'none',
              }}>
                <span style={{
                  color: 'var(--text-dim)', fontSize: 8, transition: 'transform 0.15s',
                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                  fontFamily: 'var(--font)', width: 8, flexShrink: 0,
                }}>&#9654;</span>

                {/* Category */}
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 2,
                  background: `${catColor}20`, color: catColor,
                  fontFamily: 'var(--font)', textTransform: 'uppercase', flexShrink: 0,
                  minWidth: 28, textAlign: 'center',
                }}>{r.category.slice(0, 3)}</span>

                {/* Source */}
                <span style={{
                  fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
                  background: r.readonly ? 'rgba(0,255,255,0.08)' : 'rgba(0,255,65,0.08)',
                  color: r.readonly ? 'rgba(0,255,255,0.7)' : 'rgba(0,255,65,0.7)',
                  fontFamily: 'var(--font)', textTransform: 'uppercase', flexShrink: 0,
                }}>{r.source === 'fragment' ? 'frag' : r.source === 'reference' ? 'ref' : 'usr'}</span>

                {/* Global indicator */}
                {isGlobal && activeStage && (
                  <span style={{
                    fontSize: 8, padding: '1px 5px', borderRadius: 2,
                    background: 'rgba(255,102,0,0.1)', color: 'rgba(255,102,0,0.7)',
                    fontFamily: 'var(--font)', fontWeight: 600,
                  }}>ALL</span>
                )}

                {/* Project type */}
                {r.project_type !== 'general' && (
                  <span style={{
                    fontSize: 8, padding: '1px 5px', borderRadius: 2,
                    background: 'rgba(136,68,255,0.1)', color: 'rgba(136,68,255,0.7)',
                    fontFamily: 'var(--font)', fontWeight: 600, textTransform: 'uppercase',
                  }}>{r.project_type}</span>
                )}

                {/* Title */}
                <span style={{
                  flex: 1, fontSize: 12, color: 'var(--text-primary)',
                  fontFamily: 'var(--font)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.title}</span>

                {/* Severity pill */}
                <span style={{
                  fontSize: 9, color: r.severity === 'mandatory' ? 'rgba(239,68,68,0.7)' : 'var(--text-dim)',
                  fontFamily: 'var(--font)', flexShrink: 0,
                }}>{r.severity === 'mandatory' ? '\u25CF' : '\u25CB'} {r.severity}</span>

                {/* Stage pill (when showing all) */}
                {!activeStage && (
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 2,
                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)',
                    fontFamily: 'var(--font)', flexShrink: 0,
                  }}>{r.applies_to}</span>
                )}

                {/* Custom actions */}
                {!r.readonly && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button className="btn" style={{ padding: '1px 6px', fontSize: 9 }}
                      onClick={() => setModal({ open: true, rule: r })}>EDIT</button>
                    <button className="btn btn--danger" style={{ padding: '1px 6px', fontSize: 9 }}
                      onClick={() => handleDelete(r.id)}>DEL</button>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div style={{ padding: '0 12px 10px 32px', borderTop: '1px solid var(--border)' }}>
                  {r.source_file && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font)', marginTop: 8, marginBottom: 6 }}>
                      <span style={{ color: 'var(--neon-cyan)' }}>FILE:</span> {r.source_file}
                      {' '}&middot;{' '}
                      <span style={{ color: 'var(--neon-cyan)' }}>STAGE:</span> {r.applies_to}
                      {' '}&middot;{' '}
                      <span style={{ color: 'var(--neon-cyan)' }}>TYPE:</span> {r.project_type}
                    </div>
                  )}
                  <pre style={{
                    fontSize: 11, lineHeight: 1.5, color: 'var(--text-dim)',
                    fontFamily: 'var(--font)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: 350, overflowY: 'auto', margin: 0,
                    padding: 10, background: 'var(--bg-primary)', borderRadius: 4,
                    border: '1px solid var(--border)',
                  }}>{r.content}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font)' }}>
          No rules found
        </div>
      )}

      {modal.open && <RuleModal rule={modal.rule} onSave={handleSave} onClose={() => setModal({ open: false })} />}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 11, background: 'var(--bg-input)',
  color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4,
  fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer',
};

function RuleModal({ rule, onSave, onClose }: { rule?: Rule; onSave: (data: any, id?: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState(rule?.title || '');
  const [content, setContent] = useState(rule?.content || '');
  const [category, setCategory] = useState(rule?.category || 'general');
  const [projectType, setProjectType] = useState(rule?.project_type || 'general');
  const [severity, setSeverity] = useState(rule?.severity || 'mandatory');
  const [appliesTo, setAppliesTo] = useState(rule?.applies_to || 'implement');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({ title, content, category, project_type: projectType, severity, applies_to: appliesTo, enabled: true }, rule?.id);
  };

  const fld: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 12,
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: 4,
    fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4,
    fontFamily: 'var(--font)', display: 'block',
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
        padding: 24, width: 560, maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 0 40px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--neon-orange)', margin: '0 0 20px', fontFamily: 'var(--font)' }}>
          {rule ? 'Edit Rule' : 'New Rule'}
        </h3>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={fld} placeholder="Rule title..." />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Content</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} style={{ ...fld, minHeight: 180, resize: 'vertical' }} placeholder="Rule content..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div><label style={lbl}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={fld}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label style={lbl}>Project Type</label>
            <select value={projectType} onChange={e => setProjectType(e.target.value)} style={fld}>
              {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label style={lbl}>Severity</label>
            <select value={severity} onChange={e => setSeverity(e.target.value)} style={fld}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div><label style={lbl}>Applies To (Stage)</label>
            <select value={appliesTo} onChange={e => setAppliesTo(e.target.value)} style={fld}>
              {APPLIES_TO.map(a => <option key={a} value={a}>{a}</option>)}
            </select></div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>CANCEL</button>
          <button type="submit" className="btn btn--primary">SAVE</button>
        </div>
      </form>
    </div>
  );
}
