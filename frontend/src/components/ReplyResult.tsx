import React from 'react';
import { GenerateReplyResponse } from '../types/index';

interface ReplyResultProps {
  result: GenerateReplyResponse | null;
}

export const ReplyResult: React.FC<ReplyResultProps> = ({ result }) => {
  if (!result) return null;

  return (
    <div className="card mt-6 bg-green-50 border border-green-200">
      <h2 className="text-2xl font-bold mb-4">Generated Reply</h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-1">Tone</p>
        <span className="badge badge-info">{result.tone}</span>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
        <p className="text-gray-700 whitespace-pre-wrap">{result.reply}</p>
      </div>

      <button
        className="btn-primary w-full"
        onClick={() => {
          navigator.clipboard.writeText(result.reply);
          alert('Reply copied to clipboard!');
        }}
      >
        Copy to Clipboard
      </button>
    </div>
  );
};
