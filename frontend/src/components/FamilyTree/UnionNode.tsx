import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

const UnionNode = ({ id }: { id: string }) => {
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Remove this partnership point?")) {
      deleteElements({ nodes: [{ id }] });
    }
  };

  return (
    <div className="union-node group">
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="target" position={Position.Right} id="right-target" />
      
      {/* Delete Button - Visible on Hover */}
      <button 
        className="delete-union-btn opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDelete}
      >
        <Trash2 size={8} />
      </button>

      <div className="union-dot"></div>
      
      <Handle type="source" position={Position.Bottom} id="child-source" />
      
      <style>{`
        .union-node {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .delete-union-btn {
          position: absolute;
          top: -12px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 2px;
          cursor: pointer;
          z-index: 10;
        }
        .union-dot {
          width: 8px;
          height: 8px;
          background: #2dd4bf;
          border-radius: 50%;
          box-shadow: 0 0 10px #2dd4bf;
        }
      `}</style>
    </div>
  );
};

export default memo(UnionNode);
