
import React, { useRef } from 'react';
import { VoxagenConfig } from '../types';

interface ConfigUploaderProps {
  onConfigLoaded: (config: VoxagenConfig) => void;
  config: VoxagenConfig | null;
}

const ConfigUploader: React.FC<ConfigUploaderProps> = ({ onConfigLoaded, config }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string) as VoxagenConfig;
          
          // Strict validation for GCP Service Account fields
          const requiredFields: (keyof VoxagenConfig)[] = [
            'project_id', 
            'private_key', 
            'client_email', 
            'client_id', 
            'private_key_id'
          ];
          
          const missing = requiredFields.filter(f => !json[f]);
          
          if (missing.length === 0) {
            onConfigLoaded(json);
          } else {
            alert(`Invalid Service Account JSON. Missing fields: ${missing.join(', ')}`);
          }
        } catch (err) {
          alert('Failed to parse JSON file. Ensure it is a valid Google Cloud Service Account key.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className={`p-8 rounded-[2.5rem] transition-all duration-500 ${config ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)]' : 'bg-slate-900/40 border-slate-800'} border-2 border-dashed flex flex-col md:flex-row items-center justify-between gap-6 group`}>
      <div className="flex items-center gap-6">
        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 ${config ? 'bg-emerald-500 text-white rotate-0' : 'bg-slate-800 text-slate-500 -rotate-12 group-hover:rotate-0'}`}>
          {config ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          )}
        </div>
        <div className="text-left">
          <h3 className="text-xl font-black tracking-tight text-white mb-1">
            {config ? 'GCP UPLINK ESTABLISHED' : 'AUTHORIZATION REQUIRED'}
          </h3>
          <p className="text-slate-400 text-sm font-medium">
            {config 
              ? `Project: ${config.project_id} | Identity: ${config.client_email.split('@')[0]}`
              : 'Upload Service Account JSON to activate Chirp-3 HD processing.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`px-8 py-4 rounded-2xl font-bold transition-all ${
            config 
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-900/30'
          }`}
        >
          {config ? 'Update Key' : 'Upload Key'}
        </button>
      </div>
    </div>
  );
};

export default ConfigUploader;
