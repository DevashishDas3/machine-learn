import { useRef } from "react";
import { SendIcon, SpinnerIcon, UploadIcon, XIcon } from "@/components/dashboard/icons";

interface TaskComposerProps {
  inputValue: string;
  isSubmitting: boolean;
  uploadedFiles: File[];
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
}

export function TaskComposer({
  inputValue,
  isSubmitting,
  uploadedFiles,
  onInputChange,
  onSubmit,
  onFilesSelected,
  onRemoveFile,
}: TaskComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="shrink-0 px-4 pb-6 pt-2">
      <div className="max-w-3xl mx-auto">
        <form onSubmit={onSubmit}>
          <div className="border border-white/10 bg-[#11181C]">
            {uploadedFiles.length > 0 && (
              <div className="px-4 py-2 border-b border-white/10 space-y-1">
                {uploadedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-azure truncate max-w-[300px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(index)}
                      className="text-paper/40 hover:text-paper ml-2"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => onFilesSelected(Array.from(e.target.files || []))}
                accept=".csv,.json,.parquet,.idx3-ubyte,.zip,.tar,.gz"
                multiple
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-4 text-paper/40 hover:text-paper border-r border-white/10 transition-colors"
                title="Upload dataset files"
              >
                <UploadIcon className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="> Describe your ML task..."
                disabled={isSubmitting}
                className="flex-1 px-4 py-4 bg-transparent font-mono text-sm text-paper placeholder:text-paper/30 focus:outline-none"
              />

              <button
                type="submit"
                disabled={!inputValue.trim() || isSubmitting}
                className={`px-4 py-4 transition-colors ${
                  inputValue.trim() && !isSubmitting ? "text-azure hover:bg-azure/10" : "text-paper/20 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? <SpinnerIcon className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </form>

        <p className="mt-3 text-center font-mono text-[10px] text-paper/30">
          Type a task description and press Enter to start the agent swarm. Datasets: MNIST, CIFAR-10, or upload your own.
        </p>
      </div>
    </div>
  );
}
