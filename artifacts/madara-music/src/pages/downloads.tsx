import { Download, WifiOff } from "lucide-react";

export default function Downloads() {
  return (
    <div className="p-6 md:p-12 flex flex-col items-center justify-center min-h-[70vh] text-center max-w-md mx-auto">
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 relative z-10">
          <Download className="w-10 h-10 text-white/50" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-background rounded-full flex items-center justify-center border border-white/10 z-20">
          <WifiOff className="w-5 h-5 text-white/40" />
        </div>
      </div>
      
      <h1 className="text-3xl font-bold text-white mb-4">Downloads</h1>
      <p className="text-white/60 mb-8 leading-relaxed">
        Offline downloads are coming soon to the web client. Currently, this feature is only available on our native desktop and mobile applications.
      </p>
      
      <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3 px-8 rounded-full transition-colors cursor-not-allowed opacity-50">
        Get Native App
      </button>
    </div>
  );
}
