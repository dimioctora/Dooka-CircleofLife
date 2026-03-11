import React, { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save } from 'lucide-react';
import PersonNode from './PersonNode';
import UnionNode from './UnionNode';

const nodeTypes = {
  person: PersonNode,
  union: UnionNode,
};

const initialNodes = [
  {
    id: '1',
    type: 'person',
    position: { x: 250, y: 0 },
    data: { name: 'Parent Name', birth_year: 1950, death_year: 2020, memorial_id: 'm1' },
  },
  {
    id: '2',
    type: 'person',
    position: { x: 100, y: 150 },
    data: { name: 'Child Name (1)', birth_year: 1980, death_year: null },
  },
  {
    id: '3',
    type: 'person',
    position: { x: 400, y: 150 },
    data: { name: 'Child Name (2)', birth_year: 1982, death_year: null },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', label: 'Parent' },
  { id: 'e1-3', source: '1', target: '3', label: 'Parent' },
];

const FamilyTree = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Fetch graph on load
  useEffect(() => {
    const fetchTree = async () => {
      try {
        console.log('Fetching graph from server...');
        // For now using person_id '1' as root. In production this would be dynamic.
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/api-circle';
        const response = await fetch(`${apiUrl}/circle/tree/1`);
        const data = await response.json();
        
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges);
        } else {
          // If no data, use the default starting point
          setNodes(initialNodes as any);
          setEdges(initialEdges as any);
        }
      } catch (error) {
        console.error('Error fetching tree:', error);
        // Fallback to local
        setNodes(initialNodes as any);
        setEdges(initialEdges as any);
      }
    };
    fetchTree();
  }, [setNodes, setEdges]);
  
  // New Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    birthDate: '',
    deathDate: '',
    gender: 'male',
    isDeceased: false,
    visibility: 'private'
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    if (window.confirm('Hapus garis hubungan ini?')) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }
  }, [setEdges]);

  // Helper to format date as DD / MM / YYYY
  const formatIndoDate = (value: string) => {
    const numbers = value.replace(/\D/g, ''); // Get only numbers
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)} / ${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)} / ${numbers.slice(2, 4)} / ${numbers.slice(4, 8)}`;
  };

  const parseIndoDateToISO = (indoDate: string) => {
    const parts = indoDate.split(' / ');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  };

  const saveRelative = useCallback(() => {
    if (!formData.name) return;
    
    const isoBirth = parseIndoDateToISO(formData.birthDate);
    const isoDeath = parseIndoDateToISO(formData.deathDate);
    const bYear = isoBirth ? new Date(isoBirth).getFullYear() : new Date().getFullYear();
    const dYear = formData.isDeceased && isoDeath ? new Date(isoDeath).getFullYear() : null;

    if (editingNodeId) {
      // UPDATE EXISTING NODE
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === editingNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                name: formData.name,
                email: formData.email,
                gender: formData.gender,
                birth_date: isoBirth,
                birth_year: bYear,
                death_date: formData.isDeceased ? isoDeath : null,
                death_year: dYear,
                visibility: formData.visibility
              },
            };
          }
          return node;
        }) as any
      );
    } else {
      // CREATE NEW NODE
      const newNodeId = `person-${Date.now()}`;
      const newNode = {
        id: newNodeId,
        type: 'person',
        position: { x: Math.random() * 400, y: Math.random() * 400 },
        data: { 
          name: formData.name, 
          email: formData.email,
          birth_date: isoBirth,
          birth_year: bYear, 
          death_date: formData.isDeceased ? isoDeath : null,
          death_year: dYear,
          gender: formData.gender,
          visibility: formData.visibility
        },
      };
      setNodes((nds) => nds.concat(newNode as any));
    }

    setFormData({ name: '', email: '', birthDate: '', deathDate: '', gender: 'male', isDeceased: false, visibility: 'private' });
    setEditingNodeId(null);
    setShowAddForm(false);
  }, [formData, nodes, setNodes, editingNodeId]);

  // Handle Edit Trigger from Node
  const handleEditNode = useCallback((id: string, data: any) => {
    // Convert dates back to Indo format for the form
    const toIndoDate = (iso: string) => {
      if (!iso) return '';
      const [y, m, d] = iso.split('-');
      return `${d} / ${m} / ${y}`;
    };

    setFormData({
      name: data.name || '',
      email: data.email || '',
      birthDate: toIndoDate(data.birth_date),
      deathDate: toIndoDate(data.death_date),
      gender: data.gender || 'male',
      isDeceased: !!data.death_date || !!data.death_year,
      visibility: data.visibility || 'private'
    });
    setEditingNodeId(id);
    setShowAddForm(true);
  }, []);

  const handleConnectNode = useCallback((id: string, name: string) => {
    // 1. Update node state to show connecting pulse reactively
    setNodes((nds) => 
      nds.map(node => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, isConnecting: true } };
        }
        return node;
      }) as any
    );

    // 2. Notify parent system to open selector
    window.parent.postMessage({
      type: 'OPEN_PROFILE_SELECTOR',
      node_id: id,
      node_name: name
    }, '*');
  }, [setNodes]);

  // Update nodes to include edit and connect handlers
  useEffect(() => {
    setNodes((nds) => 
      nds.map(node => {
        if (node.type === 'person') {
          const updatedData = { ...node.data } as any;
          let changed = false;
          
          if (!updatedData.onEdit) {
            updatedData.onEdit = handleEditNode;
            changed = true;
          }
          if (!updatedData.onConnect) {
            updatedData.onConnect = handleConnectNode;
            changed = true;
          }
          
          return changed ? { ...node, data: updatedData } : node;
        }
        return node;
      }) as any
    );
  }, [handleEditNode, handleConnectNode, setNodes]);

  const addNewUnion = useCallback(() => {
    const newNodeId = `union-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: 'union',
      position: { x: 300, y: 100 },
      data: {},
    };
    setNodes((nds) => nds.concat(newNode as any));
  }, [nodes, setNodes]);

  // Listen for messages from parent window (Laravel Blade)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('Family Tree received message:', event.data);
      const { type, data, node_id } = event.data;

      if (type === 'TRIGGER_ADD_RELATIVE') {
        setShowAddForm(true);
      }
      if (type === 'TRIGGER_ADD_UNION') {
        addNewUnion();
      }
      if (type === 'PROFILE_LINK_SUCCESS') {
        // Update the specific node with real data from the system
        setNodes((nds) => 
          nds.map(node => {
            if (node.id === node_id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  ...data, // Contains name, photo, dates, etc.
                  isLinked: true,
                  isConnecting: false
                }
              };
            }
            return node;
          }) as any
        );
        alert(`✨ Profil ${data.name} berhasil dihubungkan!`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addNewUnion]);

  const saveChanges = async () => {
    try {
      console.log('Pushing graph to Neo4j...');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/api-circle';
      const response = await fetch(`${apiUrl}/circle/tree/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });

      if (!response.ok) throw new Error('Network response was not ok');

      alert('✅ Silsilah berhasil disimpan secara permanen ke database Circle of Life.');
      
    } catch (error) {
      console.error('Error saving graph:', error);
      alert('Gagal menyimpan ke database. Pastikan server Backend (NestJS) aktif.');
    }
  };

  return (
    <div className="tree-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background color="#1e293b" gap={20} />
      </ReactFlow>

      {/* FLOAT SAVE BUTTON */}
      <button className="global-save-btn" onClick={saveChanges}>
        <Save size={20} />
        <span>Simpan Perubahan</span>
      </button>
      
      {/* ADD FORM OVERLAY */}
      {showAddForm && (
        <div className="add-form-overlay">
          <div className="add-form-card">
            <div className="form-header">
              <h3>{editingNodeId ? 'Edit Detail Keluarga' : 'Tambah Keluarga Baru'}</h3>
              <p>{editingNodeId ? 'Perbarui informasi anggota keluarga ini' : 'Masukkan detail untuk membuat node orang baru'}</p>
            </div>
            
            <div className="form-body">
              <div className="input-group">
                <label>Nama Lengkap</label>
                <input 
                  type="text" 
                  placeholder="Contoh: John Doe" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  autoFocus
                />
              </div>

              {!formData.isDeceased && (
                <div className="input-group animate-fade-in">
                  <label>Email (Untuk Invite)</label>
                  <input 
                    type="email" 
                    placeholder="nama@email.com" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              )}

              <div className="input-row">
                <div className="input-group">
                  <label>Tanggal Lahir</label>
                  <input 
                    type="text" 
                    placeholder="dd / mm / yyyy"
                    maxLength={14}
                    value={formData.birthDate}
                    onChange={(e) => setFormData({...formData, birthDate: formatIndoDate(e.target.value)})}
                  />
                </div>
                <div className="input-group">
                  <label>Jenis Kelamin</label>
                  <select 
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  >
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                  </select>
                </div>
              </div>

              <div className="checkbox-group">
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={formData.isDeceased}
                    onChange={(e) => setFormData({...formData, isDeceased: e.target.checked})}
                  />
                  <span className="slider round"></span>
                </label>
                <span>Meninggal Dunia?</span>
              </div>

              {formData.isDeceased && (
                <div className="input-group animate-fade-in">
                  <label>Tanggal Meninggal</label>
                  <input 
                    type="text" 
                    placeholder="dd / mm / yyyy"
                    maxLength={14}
                    value={formData.deathDate}
                    onChange={(e) => setFormData({...formData, deathDate: formatIndoDate(e.target.value)})}
                  />
                </div>
              )}

              <div className="input-group">
                <label>Visibilitas / Privacy</label>
                <select 
                  value={formData.visibility}
                  onChange={(e) => setFormData({...formData, visibility: e.target.value})}
                >
                  <option value="private">🔒 Private (Hanya Saya)</option>
                  <option value="family">👨‍👩‍👧‍👦 Family (Keluarga Terhubung)</option>
                  <option value="public">🌐 Public (Dooka Ecosystem)</option>
                </select>
              </div>
            </div>

            <div className="buttons">
              <button onClick={() => { setShowAddForm(false); setEditingNodeId(null); }} className="cancel">Batal</button>
              <button onClick={saveRelative} className="save">
                {editingNodeId ? 'Simpan Perubahan' : 'Buat Node'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .add-form-overlay {
          position: absolute;
          inset: 0;
          background: rgba(2, 6, 23, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .add-form-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 32px;
          border-radius: 24px;
          width: 380px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .form-header h3 {
          margin: 0;
          color: white;
          font-size: 1.25rem;
          font-family: 'Outfit', sans-serif;
        }
        .form-header p {
          color: #94a3b8;
          font-size: 0.85rem;
          margin: 4px 0 24px 0;
        }
        .form-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .input-group label {
          color: #94a3b8;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .add-form-card input, .add-form-card select {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px 16px;
          border-radius: 12px;
          color: white;
          outline: none;
          transition: all 0.2s;
        }
        .add-form-card input:focus, .add-form-card select:focus {
          border-color: #22d3ee;
          background: rgba(34, 211, 238, 0.05);
        }
        
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
        }
        .checkbox-group span {
          color: #cbd5e1;
          font-size: 0.9rem;
        }

        /* TOGGLE SWITCH */
        .switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 22px;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #334155;
          transition: .4s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px; width: 14px;
          left: 4px; bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .slider { background-color: #ef4444; }
        input:checked + .slider:before { transform: translateX(18px); }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .buttons {
          display: flex;
          gap: 12px;
        }
        .add-form-card button {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .add-form-card .cancel {
          background: transparent;
          color: #94a3b8;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .add-form-card .cancel:hover { background: rgba(255, 255, 255, 0.05); }
        .add-form-card .save {
          background: #0891b2;
          color: white;
          border: none;
          box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
        }
        .add-form-card .save:hover { background: #0e7490; transform: translateY(-1px); }

        .global-save-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 100;
          background: #22d3ee;
          color: #0f172a;
          border: none;
          padding: 12px 20px;
          border-radius: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 10px 25px -5px rgba(34, 211, 238, 0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .global-save-btn:hover {
          background: #67e8f9;
          transform: translateY(-2px);
          box-shadow: 0 20px 35px -5px rgba(34, 211, 238, 0.5);
        }

        .global-save-btn:active {
          transform: translateY(0);
        }
        .react-flow__controls {
          background: rgba(15, 23, 42, 0.9) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
          overflow: hidden !important;
        }
        .react-flow__controls-button {
          background: transparent !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
          fill: #22d3ee !important;
          width: 32px !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s !important;
        }
        .react-flow__controls-button:hover {
          background: rgba(34, 211, 238, 0.1) !important;
        }
        .react-flow__controls-button svg {
          width: 14px !important;
          height: 14px !important;
        }
        .react-flow__minimap {
          background-color: #0f172a !important;
          border-radius: 16px !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5) !important;
          margin: 10px !important;
        }
        .react-flow__minimap-mask {
          fill: rgba(2, 6, 23, 0.7) !important;
        }
        .react-flow__minimap-node {
          fill: #1e293b !important;
          stroke: rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default FamilyTree;
