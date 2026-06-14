import { useState } from "react";
import { Check, Copy, Terminal, Zap, Music, Bot, ChevronDown, ChevronUp } from "lucide-react";

const BOT_CODE = `# ============================================================
#  youtube.py — Madara Music Discord Bot
#  Free Discord music bot powered by your Madara Music site
# ============================================================
#
#  Requirements:
#    pip install discord.py yt-dlp aiohttp PyNaCl
#    ffmpeg must be installed on your system:
#      Linux: sudo apt install ffmpeg
#      Windows: https://ffmpeg.org/download.html
#      Mac: brew install ffmpeg
#
#  Run: python youtube.py
# ============================================================

import discord
from discord.ext import commands
import yt_dlp
import asyncio
import aiohttp

# ─── Configuration ────────────────────────────────────────────
TOKEN = "YOUR_DISCORD_BOT_TOKEN"        # Your bot token from discord.dev
MADARA_API_URL = "https://YOUR_DOMAIN/api"  # Your Madara Music domain
PREFIX = "!"
# ──────────────────────────────────────────────────────────────

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=PREFIX, intents=intents, help_command=None)

_queue: dict[int, list[dict]] = {}
_vc: dict[int, discord.VoiceClient] = {}

YDL_OPTS = {
    "format": "bestaudio/best",
    "quiet": True,
    "no_warnings": True,
    "default_search": "ytsearch",
    "source_address": "0.0.0.0",
    "noplaylist": True,
}

FFMPEG_OPTS = {
    "before_options": "-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5",
    "options": "-vn",
}

CRIMSON = 0xDC143C


# ─── Helpers ──────────────────────────────────────────────────

async def madara_search(query: str) -> dict | None:
    """Search Madara Music API first."""
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(
                f"{MADARA_API_URL}/music/search",
                params={"q": query, "limit": 5},
                timeout=aiohttp.ClientTimeout(total=6),
            ) as r:
                if r.status == 200:
                    results = await r.json()
                    return results[0] if results else None
    except Exception:
        pass
    return None


def yt_extract(query: str) -> dict | None:
    """Extract audio from YouTube via yt-dlp (sync, runs in thread)."""
    search = query if query.startswith("http") else f"ytsearch1:{query}"
    with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
        info = ydl.extract_info(search, download=False)
    if not info:
        return None
    entry = info["entries"][0] if "entries" in info else info
    formats = entry.get("formats", [])
    audio = [f for f in formats if f.get("vcodec") == "none" and f.get("url")]
    url = (
        sorted(audio, key=lambda f: f.get("abr", 0), reverse=True)[0]["url"]
        if audio
        else entry.get("url", "")
    )
    return {
        "url": url,
        "title": entry.get("title", query),
        "thumbnail": entry.get("thumbnail", ""),
        "duration": entry.get("duration", 0),
        "source": "YouTube",
    }


def fmt_duration(seconds: int) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02}:{s:02}" if h else f"{m}:{s:02}"


# ─── Player core ──────────────────────────────────────────────

async def _play_next(ctx: commands.Context, guild_id: int) -> None:
    queue = _queue.get(guild_id, [])
    if queue:
        await _stream(ctx, guild_id, queue.pop(0))


async def _stream(ctx: commands.Context, guild_id: int, song: dict) -> None:
    vc = _vc.get(guild_id)
    if not vc or not vc.is_connected():
        return

    def after(err):
        if err:
            print(f"Player error: {err}")
        asyncio.run_coroutine_threadsafe(_play_next(ctx, guild_id), bot.loop)

    vc.play(discord.FFmpegPCMAudio(song["url"], **FFMPEG_OPTS), after=after)

    embed = discord.Embed(
        title="Now Playing",
        description=f"**{song['title']}**",
        color=CRIMSON,
    )
    if song.get("thumbnail"):
        embed.set_thumbnail(url=song["thumbnail"])
    if song.get("duration"):
        embed.add_field(name="Duration", value=fmt_duration(song["duration"]))
    embed.add_field(name="Source", value=song.get("source", "Madara Music"))
    embed.add_field(name="Requested by", value=song["requester"].mention)
    embed.set_footer(text=f"Madara Music Bot • {MADARA_API_URL.replace('/api', '')}")
    await ctx.send(embed=embed)


# ─── Commands ─────────────────────────────────────────────────

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.listening,
            name=f"music | {PREFIX}play",
        )
    )


@bot.command(aliases=["p"])
async def play(ctx: commands.Context, *, query: str):
    """Play a song — searches Madara Music first, then YouTube."""
    if not ctx.author.voice:
        await ctx.send("Join a voice channel first!")
        return

    gid = ctx.guild.id
    if gid not in _queue:
        _queue[gid] = []

    async with ctx.typing():
        track = await madara_search(query)
        if track and track.get("previewUrl"):
            song = {
                "url": track["previewUrl"],
                "title": f"{track['title']} — {track['artist']}",
                "thumbnail": track.get("thumbnail", ""),
                "duration": track.get("duration", 0),
                "source": "Madara Music",
                "requester": ctx.author,
            }
        else:
            info = await asyncio.to_thread(yt_extract, query)
            if not info:
                await ctx.send("Could not find that track.")
                return
            info["requester"] = ctx.author
            song = info

    if gid not in _vc or not _vc[gid].is_connected():
        _vc[gid] = await ctx.author.voice.channel.connect()

    if _vc[gid].is_playing() or _vc[gid].is_paused():
        _queue[gid].append(song)
        await ctx.send(
            embed=discord.Embed(
                title="Added to Queue",
                description=f"**{song['title']}**\nPosition: #{len(_queue[gid])}",
                color=CRIMSON,
            )
        )
    else:
        await _stream(ctx, gid, song)


@bot.command()
async def skip(ctx: commands.Context):
    vc = _vc.get(ctx.guild.id)
    if vc and vc.is_playing():
        vc.stop()
        await ctx.send("Skipped.")
    else:
        await ctx.send("Nothing is playing.")


@bot.command()
async def stop(ctx: commands.Context):
    gid = ctx.guild.id
    _queue.pop(gid, None)
    vc = _vc.pop(gid, None)
    if vc:
        vc.stop()
        await vc.disconnect()
    await ctx.send("Stopped and disconnected.")


@bot.command()
async def pause(ctx: commands.Context):
    vc = _vc.get(ctx.guild.id)
    if vc and vc.is_playing():
        vc.pause()
        await ctx.send("Paused.")


@bot.command()
async def resume(ctx: commands.Context):
    vc = _vc.get(ctx.guild.id)
    if vc and vc.is_paused():
        vc.resume()
        await ctx.send("Resumed.")


@bot.command(aliases=["q"])
async def queue(ctx: commands.Context):
    items = _queue.get(ctx.guild.id, [])
    if not items:
        await ctx.send("Queue is empty.")
        return
    embed = discord.Embed(title="Queue", color=CRIMSON)
    for i, s in enumerate(items[:15], 1):
        embed.add_field(
            name=f"{i}. {s['title'][:55]}",
            value=f"by {s['requester'].display_name}",
            inline=False,
        )
    if len(items) > 15:
        embed.set_footer(text=f"...and {len(items) - 15} more tracks")
    await ctx.send(embed=embed)


@bot.command(aliases=["vol"])
async def volume(ctx: commands.Context, vol: int):
    vc = _vc.get(ctx.guild.id)
    if not vc:
        await ctx.send("Not connected.")
        return
    vol = max(0, min(200, vol))
    if isinstance(vc.source, discord.PCMVolumeTransformer):
        vc.source.volume = vol / 100
    await ctx.send(f"Volume set to **{vol}%**")


@bot.command()
async def help(ctx: commands.Context):
    embed = discord.Embed(
        title="Madara Music Bot Commands",
        description=(
            f"Prefix: \`{PREFIX}\`  •  "
            f"Powered by [Madara Music]({MADARA_API_URL.replace('/api', '')})"
        ),
        color=CRIMSON,
    )
    for name, desc in [
        ("play <song or URL>", "Play from Madara Music or YouTube"),
        ("skip", "Skip the current track"),
        ("stop", "Stop and leave the channel"),
        ("pause / resume", "Pause or resume"),
        ("queue", "See the queue"),
        ("volume <0-200>", "Adjust volume"),
    ]:
        embed.add_field(name=f"\`{PREFIX}{name}\`", value=desc, inline=False)
    embed.set_footer(text="Free music for everyone — Madara Music")
    await ctx.send(embed=embed)


bot.run(TOKEN)`;

const STEPS = [
  {
    num: "01",
    title: "Create a Discord Bot",
    desc: 'Go to discord.com/developers → New Application → Bot → Copy Token. Enable "Message Content Intent".',
  },
  {
    num: "02",
    title: "Install dependencies",
    code: "pip install discord.py yt-dlp aiohttp PyNaCl",
    desc: "Also install ffmpeg on your system (see comments in the code).",
  },
  {
    num: "03",
    title: "Configure the bot",
    desc: 'Edit the TOKEN and MADARA_API_URL at the top of youtube.py with your bot token and your Madara Music domain.',
  },
  {
    num: "04",
    title: "Invite the bot",
    desc: 'In Discord Developer Portal → OAuth2 → URL Generator. Scopes: bot. Permissions: Send Messages, Connect, Speak.',
  },
  {
    num: "05",
    title: "Run the bot",
    code: "python youtube.py",
    desc: "The bot will go online and respond to your commands.",
  },
];

export default function BotPage() {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(BOT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
          <Bot className="w-4 h-4" />
          Discord Music Bot
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          Free Music Bot
          <br />
          <span className="text-primary">Powered by Madara Music</span>
        </h1>
        <p className="text-white/50 text-lg max-w-xl mx-auto">
          A full-featured Discord music bot that searches your Madara Music
          library first, then falls back to YouTube — completely free.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { icon: <Music className="w-3.5 h-3.5" />, label: "iTunes + YouTube" },
          { icon: <Zap className="w-3.5 h-3.5" />, label: "No API Key" },
          { icon: <Terminal className="w-3.5 h-3.5" />, label: "Python 3.10+" },
          { icon: <Bot className="w-3.5 h-3.5" />, label: "discord.py" },
        ].map(({ icon, label }) => (
          <span
            key={label}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/70 px-3 py-1.5 rounded-full text-sm"
          >
            {icon}
            {label}
          </span>
        ))}
      </div>

      {/* Commands quick reference */}
      <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          Commands
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ["!play <song>", "Play a track"],
            ["!skip", "Skip current"],
            ["!stop", "Stop & leave"],
            ["!pause / !resume", "Pause toggle"],
            ["!queue", "View queue"],
            ["!volume <0-200>", "Set volume"],
          ].map(([cmd, desc]) => (
            <div key={cmd} className="bg-white/5 rounded-xl p-3">
              <code className="text-primary text-sm font-mono">{cmd}</code>
              <p className="text-white/50 text-xs mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Setup steps */}
      <div>
        <h2 className="text-white font-bold text-xl mb-6">Setup Guide</h2>
        <div className="space-y-4">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="flex gap-4 bg-white/3 border border-white/8 rounded-2xl p-5"
            >
              <span className="text-primary font-bold text-lg font-mono shrink-0 w-8">
                {step.num}
              </span>
              <div className="space-y-1.5">
                <p className="text-white font-semibold">{step.title}</p>
                <p className="text-white/50 text-sm">{step.desc}</p>
                {step.code && (
                  <code className="block mt-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-green-400 text-sm font-mono">
                    $ {step.code}
                  </code>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code block */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            youtube.py
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCode(!showCode)}
              className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
            >
              {showCode ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {showCode ? "Collapse" : "Expand"}
            </button>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                copied
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-primary/90 hover:bg-primary text-white"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Code
                </>
              )}
            </button>
          </div>
        </div>

        {showCode && (
          <div className="relative rounded-2xl overflow-hidden border border-white/10">
            {/* Terminal header */}
            <div className="flex items-center gap-1.5 px-4 py-3 bg-white/5 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-white/30 text-sm font-mono">youtube.py</span>
            </div>
            {/* Code content */}
            <pre className="overflow-auto max-h-[600px] p-6 bg-[hsl(240,10%,5%)] text-sm leading-relaxed">
              <code className="text-white/80 font-mono whitespace-pre">
                {BOT_CODE.split("\n").map((line, i) => {
                  let color = "text-white/75";
                  if (line.trim().startsWith("#")) color = "text-white/35 italic";
                  else if (
                    line.includes("async def ") ||
                    line.includes("def ") ||
                    line.includes("class ")
                  )
                    color = "text-blue-400";
                  else if (
                    line.includes("import ") ||
                    line.includes("from ")
                  )
                    color = "text-purple-400";
                  else if (line.includes("@bot.") || line.includes("@bot.event"))
                    color = "text-yellow-400";
                  else if (
                    line.trim().startsWith("TOKEN") ||
                    line.trim().startsWith("MADARA_") ||
                    line.trim().startsWith("PREFIX")
                  )
                    color = "text-green-400";
                  else if (line.includes("await "))
                    color = "text-cyan-400";
                  return (
                    <span key={i} className={`block ${color}`}>
                      {line || " "}
                    </span>
                  );
                })}
              </code>
            </pre>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="text-center text-white/30 text-sm pb-4">
        This bot is open source and free to use.
        Searches Madara Music first, falls back to YouTube automatically.
      </div>
    </div>
  );
}
