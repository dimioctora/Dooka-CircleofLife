import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { User, Heart, Trash2, Mail, Edit2, Lock, Link as LinkIcon, Users, Globe, CheckCircle2 } from 'lucide-react';

const PersonNode = ({ id, data }: { id: string, data: any }) => {
  const isMemorial = !!data.memorial_id;
  const { deleteElements } = useReactFlow();

  const handleNodeClick = () => {
    if (isMemorial) {
      window.parent.postMessage({
        type: 'NODE_CLICK',
        memorial_id: data.memorial_id,
        name: data.name
      }, '*');
    }
  };

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onConnect) {
      data.onConnect(id, data.name);
    }
  };

  const handleInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.email) {
      window.parent.postMessage({
        type: 'INVITE_MEMBER',
        email: data.email,
        name: data.name
      }, '*');
      alert(`✅ Undangan sedang dikirim ke ${data.email}`);
    } else {
      alert('Silakan tambahkan email di detail profil untuk mengirim undangan.');
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents triggering node click
    if (window.confirm(`Are you sure you want to remove ${data.name} from the tree?`)) {
      deleteElements({ nodes: [{ id }] });
    }
  };

  return (
    <div 
      className={`person-node ${isMemorial ? 'memorial' : ''} ${data.isConnecting ? 'connecting' : ''} ${data.isLinked ? 'linked' : ''} group`}
      onClick={handleNodeClick}
      style={{ cursor: (isMemorial || data.isLinked) ? 'pointer' : 'default' }}
    >
      <Handle type="target" position={Position.Top} id="top-target" />
      
      <div className="node-actions opacity-0 group-hover:opacity-100 transition-opacity">
        {!isMemorial && (
          <button 
            className="connect-node-btn"
            onClick={handleConnect}
            title="Hubungkan ke Profil/Memorial"
          >
            <LinkIcon size={9} />
          </button>
        )}
        {data.onEdit && (
          <button 
            className="edit-node-btn"
            onClick={(e) => { e.stopPropagation(); data.onEdit(id, data); }}
            title="Edit Detail"
          >
            <Edit2 size={9} />
          </button>
        )}
        <button 
          className="delete-node-btn"
          onClick={handleDelete}
          title="Remove from tree"
        >
          <Trash2 size={9} />
        </button>
      </div>

      <div className="node-content">
        <div className="profile-photo">
          {data.photo ? <img src={data.photo} alt={data.name} /> : <User size={24} />}
          {isMemorial && <div className="memorial-badge"><Heart size={10} fill="#ef4444" color="#ef4444" /></div>}
        </div>
        
        <div className="node-info">
          <div className="node-name">
            {data.name}
            {data.visibility === 'private' && <Lock size={10} style={{ marginLeft: 4, color: '#ef4444' }} />}
            {data.isLinked && <CheckCircle2 size={10} style={{ marginLeft: 4, color: '#10b981' }} />}
          </div>
          <div className="node-years">
            {data.birth_year} – {data.death_year || 'Present'}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="source" position={Position.Right} id="right-source" />
      <Handle type="source" position={Position.Left} id="left-source" />

      <style>{`
        .person-node {
          padding: 12px;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid #30363d;
          width: 240px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: #e6edf3;
          font-family: 'Inter', sans-serif;
        }
        
        .person-node:hover {
          transform: translateY(-4px);
          border-color: #8b5cf6;
          box-shadow: 0 12px 48px rgba(139, 92, 246, 0.2);
        }

        .person-node.memorial {
          border-left: 4px solid #ef4444;
        }

        .person-node.connecting {
          border-color: #06b6d4;
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.4);
          animation: pulse-border 1.5s infinite;
        }

        .person-node.linked {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        @keyframes pulse-border {
          0% { border-color: #06b6d4; opacity: 1; }
          50% { border-color: #22d3ee; opacity: 0.7; }
          100% { border-color: #06b6d4; opacity: 1; }
        }

        .node-actions {
          position: absolute;
          top: -8px;
          right: -4px;
          display: flex;
          gap: 3px;
          z-index: 100;
          background: rgba(15, 23, 42, 0.9);
          padding: 2px 3px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        }

        .delete-node-btn, .invite-node-btn, .edit-node-btn, .connect-node-btn {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 1;
        }

        .delete-node-btn { background: #ef4444; }
        .invite-node-btn { background: #06b6d4; }
        .edit-node-btn { background: #6366f1; }
        .connect-node-btn { background: #10b981; }

        .delete-node-btn:hover { background: #f87171; transform: scale(1.15); opacity: 1; }
        .invite-node-btn:hover { background: #22d3ee; transform: scale(1.15); opacity: 1; }
        .edit-node-btn:hover { background: #818cf8; transform: scale(1.15); opacity: 1; }
        .connect-node-btn:hover { background: #34d399; transform: scale(1.15); opacity: 1; }

        .node-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .profile-photo {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          border-radius: 12px;
          background: #30363d;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8b949e;
          position: relative;
          overflow: hidden;
        }

        .memorial-badge {
          position: absolute;
          bottom: 0;
          right: 0;
          background: white;
          padding: 2px;
          border-radius: 50% 0 0 0;
          display: flex;
        }
        .node-info {
          flex: 1;
          min-width: 0;
        }

        .node-name {
          font-weight: 600;
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .node-years {
          font-size: 0.75rem;
          color: #8b949e;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
};

export default memo(PersonNode);
