import { useState, useEffect } from 'react';
import { AGENT_MAP } from '../lib/constants';
import { api } from '../lib/api';

const AVAILABLE_MODELS = [
  { id: 'kimi-k2p5', full: 'kimi-coding/k2p5', label: 'Kimi K2.5', tier: 'budget' },
  { id: 'minimax-m2.5', full: 'minimax/MiniMax-M2.5', label: 'MiniMax M2.5', tier: 'budget' },
  { id: 'glm-4.7', full: 'zai/glm-4.7', label: 'GLM 4.7', tier: 'budget' },
  { id: 'sonnet-4.5', full: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5', tier: 'premium' },
  { id: 'opus-4.6', full: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6', tier: 'premium' },
  { id: 'deepseek-chat', full: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', tier: 'budget' },
  { id: 'deepseek-reasoner', full: 'deepseek/deepseek-reasoner', label: 'DeepSeek R1', tier: 'budget' },
  { id: 'grok-3', full: 'xai/grok-3', label: 'Grok 3', tier: 'premium' },
];

// Normalize full model string to short id
function toShortId(modelStr: string): string {
  const found = AVAILABLE_MODELS.find(m => m.full === modelStr || m.id === modelStr);
  return found ? found.id : modelStr;
}

const AVAILABLE_ROLES = [
  'CEO / Orchestrator',
  'Lead Developer',
  'Senior Architect',
  'Infrastructure Lead',
  'Backend Developer',
  'Frontend Developer',
  'Research Lead',
  'QA Lead',
  'Content Writer',
  'SRE / Monitoring',
  'Security Engineer',
  'Data Analyst',
  'DevOps Engineer',
  'Full-Stack Developer',
];

interface Props {
  agent: any;
  onClose: () => void;
  onSave: (agentId: string, changes: any) => void;
}

export function AgentEditModal({ agent, onClose, onSave }: Props) {
  const meta = AGENT_MAP[agent.id];
  const [name, setName] = useState(agent.identityName || agent.name || meta?.name || agent.id);
  const [role, setRole] = useState(agent.role || meta?.role || '');
  const [model, setModel] = useState(toShortId(agent.model || meta?.model || ''));
  const [description, setDescription] = useState(agent.description || meta?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const emoji = agent.identityEmoji || meta?.emoji || '?';
  const color = meta?.color || '#00ffff';

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await onSave(agent.id, { name, role, model, description });
      setSuccess('Saved!');
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const tierColor = (tier: string) => {
    switch (tier) {
      case 'free': return '#00ff41';
      case 'budget': return '#00ffff';
      case 'premium': return '#ff6600';
      default: return '#666';
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal agent-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agent-edit-modal__header">
          <span className="agent-edit-modal__emoji" style={{ color }}>{emoji}</span>
          <h3>{name}</h3>
          <button className="agent-edit-modal__close" onClick={onClose}>✕</button>
        </div>

        <label>
          <span className="agent-edit-modal__label">NAME</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent name"
          />
        </label>

        <label>
          <span className="agent-edit-modal__label">ROLE</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Select role...</option>
            {AVAILABLE_ROLES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Or type custom role..."
            style={{ marginTop: '4px' }}
          />
        </label>

        <label>
          <span className="agent-edit-modal__label">MODEL</span>
          <div className="agent-edit-modal__models">
            {AVAILABLE_MODELS.map(m => (
              <button
                key={m.id}
                className={`agent-edit-modal__model-btn ${model === m.id ? 'agent-edit-modal__model-btn--active' : ''}`}
                onClick={() => setModel(m.id)}
                style={{
                  borderColor: model === m.id ? tierColor(m.tier) : undefined,
                  color: model === m.id ? tierColor(m.tier) : undefined,
                }}
              >
                <span className="agent-edit-modal__model-dot" style={{ background: tierColor(m.tier) }} />
                {m.label}
              </button>
            ))}
          </div>
        </label>

        <label>
          <span className="agent-edit-modal__label">DESCRIPTION</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this agent do?"
            rows={2}
          />
        </label>

        {error && <div className="agent-edit-modal__error">{error}</div>}
        {success && <div className="agent-edit-modal__success">{success}</div>}

        <div className="modal__actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
