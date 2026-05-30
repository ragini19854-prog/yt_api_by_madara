import { Monitor, Moon, Volume2, Shield, Bell, Info } from "lucide-react";

export default function Settings() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Settings</h1>
        <p className="text-white/50">Manage your application preferences.</p>
      </div>

      <div className="space-y-6">
        <SettingSection title="Appearance" icon={<Monitor className="w-5 h-5" />}>
          <SettingItem 
            title="Theme" 
            description="Madara Music is designed exclusively for dark mode to provide a premium cinematic experience."
            action={
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full border border-white/10 text-white text-sm">
                <Moon className="w-4 h-4" /> Dark Mode Forced
              </div>
            }
          />
        </SettingSection>

        <SettingSection title="Audio Quality" icon={<Volume2 className="w-5 h-5" />}>
          <SettingItem 
            title="Streaming Quality" 
            description="Select the default streaming quality for playback."
            action={
              <select className="bg-background border border-white/10 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary">
                <option>Auto</option>
                <option>High (320kbps)</option>
                <option>Normal (128kbps)</option>
                <option>Data Saver</option>
              </select>
            }
          />
          <SettingItem 
            title="Normalize Volume" 
            description="Set the same volume level for all tracks."
            action={<Toggle defaultChecked />}
          />
        </SettingSection>

        <SettingSection title="Privacy & Security" icon={<Shield className="w-5 h-5" />}>
          <SettingItem 
            title="Private Session" 
            description="Temporarily hide your listening activity."
            action={<Toggle />}
          />
        </SettingSection>

        <SettingSection title="About" icon={<Info className="w-5 h-5" />}>
          <SettingItem 
            title="Version" 
            description="Madara Music Web Client"
            action={<span className="text-white/50 text-sm">v1.0.0</span>}
          />
        </SettingSection>
      </div>
    </div>
  );
}

function SettingSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center gap-3 text-white font-medium">
        {icon} {title}
      </div>
      <div className="divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function SettingItem({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="px-6 py-5 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium mb-1">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed">{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} />
      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  );
}
