import { useState } from "react";
import {
  Check, Copy, Terminal, Zap, Music, Bot, ChevronDown, ChevronUp,
  Wifi, Shield, Server, Send, AlertTriangle, Clock
} from "lucide-react";

// ─── Discord Bot Code ──────────────────────────────────────────────────────────
const DISCORD_BOT_CODE = `# ============================================================
#  youtube.py — Madara Music Discord Bot
#  Free 24/7 Discord music bot powered by Madara Music
# ============================================================
#
#  Requirements:
#    pip install discord.py yt-dlp aiohttp PyNaCl
#    ffmpeg required: sudo apt install ffmpeg  (Linux)
#                     brew install ffmpeg      (Mac)
#                     https://ffmpeg.org       (Windows)
#
#  Run: python youtube.py
# ============================================================
#
# !! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ !!
# !!  WARNING  WARNING  WARNING  WARNING  WARNING  WARNING   !!
# !!                                                         !!
# !!  DO NOT REMOVE OR MODIFY THE "Powered by Madara Music"  !!
# !!  ATTRIBUTION. It is legally required under the terms    !!
# !!  of use. Tampering activates the anti-tamper system     !!
# !!  which floods your terminal with errors and crashes     !!
# !!  the bot permanently until attribution is restored.     !!
# !!                                                         !!
# !! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ !!
#
# ============================================================

import discord
from discord.ext import commands
import yt_dlp
import asyncio
import aiohttp
import hashlib
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

# ─── Configuration ────────────────────────────────────────────────────────────
TOKEN          = "YOUR_DISCORD_BOT_TOKEN"        # discord.dev/applications
MADARA_API_URL = "https://YOUR_DOMAIN/api"       # Your Madara Music domain
PREFIX         = "!"
KEEPALIVE_PORT = 8080                            # Port for UptimeRobot pings
# ──────────────────────────────────────────────────────────────────────────────

# !! ─────────────────────────────────────────────────────── !!
# !! DO NOT MODIFY ANYTHING BETWEEN THESE LINES             !!
# !! ANTI-TAMPER SYSTEM — PROTECTED ATTRIBUTION BLOCK       !!
_MADARA_CREDIT   = "Powered by Madara Music"                   # DO NOT CHANGE
_REQUIRED_HASH   = "9a58f69afc43874694a9dfa73b4714b69264652161e7f9377a24212a9ea48ed0"

def _anti_tamper_check():
    """Attribution guard. DO NOT REMOVE, RENAME, OR MODIFY."""
    actual_hash = hashlib.sha256(_MADARA_CREDIT.encode()).hexdigest()
    if actual_hash != _REQUIRED_HASH:
        def _flood_errors():
            msgs = [
                "[MADARA ANTI-TAMPER] CRITICAL: Attribution removed!",
                "[MADARA ANTI-TAMPER] Restore 'Powered by Madara Music' to fix.",
                "[MADARA ANTI-TAMPER] This bot is disabled until credit is restored.",
                "[MADARA ANTI-TAMPER] https://madara-music.replit.app — Madara Music",
            ]
            while True:
                for msg in msgs:
                    print(msg, file=sys.stderr, flush=True)
                    time.sleep(0.001)  # 100 errors per ~100ms
        t = threading.Thread(target=_flood_errors, daemon=False)
        t.start()
        time.sleep(0.1)
        sys.exit(1)

_anti_tamper_check()  # DO NOT REMOVE THIS LINE
# !! END OF PROTECTED BLOCK ────────────────────────────────── !!

# ─── 24/7 Keep-alive server (ping this with UptimeRobot) ──────────────────────
class _PingHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"Madara Music Bot — Online 24/7"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_): pass

def _start_keepalive():
    """Start HTTP server so UptimeRobot can keep the bot alive 24/7."""
    server = HTTPServer(("0.0.0.0", KEEPALIVE_PORT), _PingHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    print(f"[Madara] Keep-alive server running on port {KEEPALIVE_PORT}")

_start_keepalive()
# ──────────────────────────────────────────────────────────────────────────────

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

# ─── Helpers ──────────────────────────────────────────────────────────────────

async def madara_search(query: str) -> dict | None:
    """Search Madara Music API first (searches iTunes + YouTube)."""
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
    """Fallback: extract audio directly from YouTube via yt-dlp."""
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
        if audio else entry.get("url", "")
    )
    return {
        "url": url,
        "title": entry.get("title", query),
        "thumbnail": entry.get("thumbnail", ""),
        "duration": entry.get("duration", 0),
        "source": "YouTube via yt-dlp",
    }


def fmt(sec: int) -> str:
    m, s = divmod(int(sec), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02}:{s:02}" if h else f"{m}:{s:02}"


# ─── Player ───────────────────────────────────────────────────────────────────

async def _play_next(ctx, gid):
    q = _queue.get(gid, [])
    if q:
        await _stream(ctx, gid, q.pop(0))


async def _stream(ctx, gid, song):
    vc = _vc.get(gid)
    if not vc or not vc.is_connected():
        return
    def after(err):
        if err:
            print(f"Player error: {err}")
        asyncio.run_coroutine_threadsafe(_play_next(ctx, gid), bot.loop)
    vc.play(discord.FFmpegPCMAudio(song["url"], **FFMPEG_OPTS), after=after)
    embed = discord.Embed(
        title="Now Playing",
        description=f"**{song['title']}**",
        color=CRIMSON,
    )
    if song.get("thumbnail"):
        embed.set_thumbnail(url=song["thumbnail"])
    if song.get("duration"):
        embed.add_field(name="Duration", value=fmt(song["duration"]))
    embed.add_field(name="Source", value=song.get("source", "Madara Music"))
    embed.add_field(name="Requested by", value=song["requester"].mention)
    # !! DO NOT REMOVE THE FOOTER LINE BELOW — REQUIRED ATTRIBUTION !!
    embed.set_footer(text=f"{_MADARA_CREDIT} • {MADARA_API_URL.replace('/api', '')}")
    await ctx.send(embed=embed)


# ─── Events & Commands ────────────────────────────────────────────────────────

@bot.event
async def on_ready():
    print(f"[Madara] Online as {bot.user} | {len(bot.guilds)} servers")
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.listening,
            name=f"music | {PREFIX}play",
        )
    )


@bot.command(aliases=["p"])
async def play(ctx, *, query: str):
    """Play from Madara Music API first, then YouTube fallback."""
    if not ctx.author.voice:
        await ctx.send("Join a voice channel first!")
        return
    gid = ctx.guild.id
    _queue.setdefault(gid, [])
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
                await ctx.send("Could not find that track anywhere.")
                return
            info["requester"] = ctx.author
            song = info
    if gid not in _vc or not _vc[gid].is_connected():
        _vc[gid] = await ctx.author.voice.channel.connect()
    if _vc[gid].is_playing() or _vc[gid].is_paused():
        _queue[gid].append(song)
        await ctx.send(embed=discord.Embed(
            title="Added to Queue",
            description=f"**{song['title']}**\nPosition #{len(_queue[gid])}",
            color=CRIMSON,
        ))
    else:
        await _stream(ctx, gid, song)


@bot.command()
async def skip(ctx):
    vc = _vc.get(ctx.guild.id)
    if vc and vc.is_playing():
        vc.stop(); await ctx.send("Skipped.")
    else:
        await ctx.send("Nothing is playing.")


@bot.command()
async def stop(ctx):
    gid = ctx.guild.id
    _queue.pop(gid, None)
    vc = _vc.pop(gid, None)
    if vc:
        vc.stop(); await vc.disconnect()
    await ctx.send("Stopped.")


@bot.command()
async def pause(ctx):
    vc = _vc.get(ctx.guild.id)
    if vc and vc.is_playing():
        vc.pause(); await ctx.send("Paused.")


@bot.command()
async def resume(ctx):
    vc = _vc.get(ctx.guild.id)
    if vc and vc.is_paused():
        vc.resume(); await ctx.send("Resumed.")


@bot.command(aliases=["q"])
async def queue(ctx):
    items = _queue.get(ctx.guild.id, [])
    if not items:
        await ctx.send("Queue is empty."); return
    embed = discord.Embed(title="Queue", color=CRIMSON)
    for i, s in enumerate(items[:15], 1):
        embed.add_field(name=f"{i}. {s['title'][:55]}", value=s["requester"].display_name, inline=False)
    if len(items) > 15:
        embed.set_footer(text=f"...and {len(items)-15} more")
    await ctx.send(embed=embed)


@bot.command(aliases=["vol"])
async def volume(ctx, vol: int):
    vc = _vc.get(ctx.guild.id)
    if not vc: await ctx.send("Not connected."); return
    vol = max(0, min(200, vol))
    if isinstance(vc.source, discord.PCMVolumeTransformer):
        vc.source.volume = vol / 100
    await ctx.send(f"Volume: **{vol}%**")


@bot.command()
async def help(ctx):
    embed = discord.Embed(
        title="Madara Music Bot",
        description=f"Prefix: \`{PREFIX}\`",
        color=CRIMSON,
    )
    for name, desc in [
        ("play <song>",    "Madara Music API → YouTube fallback"),
        ("skip",           "Skip current track"),
        ("stop",           "Stop & disconnect"),
        ("pause/resume",   "Pause or resume"),
        ("queue",          "View the queue"),
        ("volume <0-200>", "Set volume"),
    ]:
        embed.add_field(name=f"\`{PREFIX}{name}\`", value=desc, inline=False)
    # !! DO NOT REMOVE THIS LINE — REQUIRED ATTRIBUTION !!
    embed.set_footer(text=f"{_MADARA_CREDIT} — Free music, no paid APIs")
    await ctx.send(embed=embed)


bot.run(TOKEN)
`;

// ─── Telegram Bot Code ─────────────────────────────────────────────────────────
const TELEGRAM_BOT_CODE = `# ============================================================
#  telegram.py — Madara Music Telegram Bot
#  Free 24/7 Telegram music bot powered by Madara Music
# ============================================================
#
#  Requirements:
#    pip install python-telegram-bot yt-dlp aiohttp
#    ffmpeg required: sudo apt install ffmpeg
#
#  Run: python telegram.py
# ============================================================
#
# !! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ !!
# !!  WARNING  WARNING  WARNING  WARNING  WARNING  WARNING   !!
# !!                                                         !!
# !!  DO NOT REMOVE OR MODIFY THE "Powered by Madara Music"  !!
# !!  ATTRIBUTION. It is legally required under the terms    !!
# !!  of use. Tampering activates the anti-tamper system     !!
# !!  which floods your terminal and crashes the bot.        !!
# !!                                                         !!
# !! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ !!
#
# ============================================================

import asyncio
import hashlib
import sys
import threading
import time
import aiohttp
import yt_dlp
from http.server import HTTPServer, BaseHTTPRequestHandler
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    filters, ContextTypes,
)

# ─── Configuration ────────────────────────────────────────────────────────────
TELEGRAM_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"      # @BotFather on Telegram
MADARA_API_URL  = "https://YOUR_DOMAIN/api"     # Your Madara Music domain
KEEPALIVE_PORT  = 8080                          # For UptimeRobot 24/7 pings
# ──────────────────────────────────────────────────────────────────────────────

# !! ─────────────────────────────────────────────────────── !!
# !! DO NOT MODIFY ANYTHING BETWEEN THESE LINES             !!
# !! ANTI-TAMPER SYSTEM — PROTECTED ATTRIBUTION BLOCK       !!
_MADARA_CREDIT  = "Powered by Madara Music"                    # DO NOT CHANGE
_REQUIRED_HASH  = "9a58f69afc43874694a9dfa73b4714b69264652161e7f9377a24212a9ea48ed0"

def _anti_tamper_check():
    """Attribution guard. DO NOT REMOVE, RENAME, OR MODIFY."""
    actual = hashlib.sha256(_MADARA_CREDIT.encode()).hexdigest()
    if actual != _REQUIRED_HASH:
        def _flood():
            while True:
                for msg in [
                    "[MADARA ANTI-TAMPER] CRITICAL: Attribution removed!",
                    "[MADARA ANTI-TAMPER] Restore 'Powered by Madara Music' to fix.",
                    "[MADARA ANTI-TAMPER] Bot disabled until credit is restored.",
                    "[MADARA ANTI-TAMPER] https://madara-music.replit.app",
                ]:
                    print(msg, file=sys.stderr, flush=True)
                    time.sleep(0.001)
        threading.Thread(target=_flood, daemon=False).start()
        time.sleep(0.1)
        sys.exit(1)

_anti_tamper_check()  # DO NOT REMOVE THIS LINE
# !! END OF PROTECTED BLOCK ────────────────────────────────── !!

# ─── 24/7 Keep-alive (ping with UptimeRobot) ──────────────────────────────────
class _PingHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"Madara Music Telegram Bot — Online 24/7"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_): pass

threading.Thread(
    target=lambda: HTTPServer(("0.0.0.0", KEEPALIVE_PORT), _PingHandler).serve_forever(),
    daemon=True,
).start()
print(f"[Madara] Keep-alive server on port {KEEPALIVE_PORT}")
# ──────────────────────────────────────────────────────────────────────────────

YDL_OPTS = {
    "format": "bestaudio/best",
    "quiet": True,
    "no_warnings": True,
    "default_search": "ytsearch",
    "noplaylist": True,
    "outtmpl": "/tmp/madara_%(id)s.%(ext)s",
}

# Per-chat queue
_queues: dict[int, list[dict]] = {}


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def madara_search(query: str) -> dict | None:
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


def yt_download(query: str) -> str | None:
    """Download audio and return local file path."""
    search = query if query.startswith("http") else f"ytsearch1:{query}"
    with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
        info = ydl.extract_info(search, download=True)
    if not info:
        return None
    entry = info["entries"][0] if "entries" in info else info
    return ydl.prepare_filename(entry)


def fmt(sec: int) -> str:
    m, s = divmod(int(sec), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02}:{s:02}" if h else f"{m}:{s:02}"


# ─── Command Handlers ─────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton("Visit Madara Music", url=MADARA_API_URL.replace("/api", ""))]]
    await update.message.reply_text(
        f"🎵 *Madara Music Bot*\\n\\n"
        f"Send me a song name to search and download it\\!\\n\\n"
        f"Commands:\\n"
        f"/play \\<song\\> — Search and send audio\\n"
        f"/search \\<song\\> — Show top 5 results\\n"
        f"/help — Show all commands\\n\\n"
        f"_{_MADARA_CREDIT}_",  # DO NOT REMOVE THIS LINE
        parse_mode="MarkdownV2",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def cmd_play(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /play <song name or URL>")
        return
    query = " ".join(ctx.args)
    msg = await update.message.reply_text(f"🔍 Searching for *{query}*...", parse_mode="Markdown")
    # Try Madara Music API first
    track = await madara_search(query)
    if track and track.get("previewUrl"):
        caption = (
            f"🎵 *{track['title']}*\\n"
            f"👤 {track['artist']}\\n"
            f"🔗 Source: Madara Music\\n\\n"
            f"_{_MADARA_CREDIT}_"  # DO NOT REMOVE THIS LINE
        )
        await msg.edit_text("📥 Fetching from Madara Music...")
        keyboard = [[InlineKeyboardButton("Open in Madara Music", url=MADARA_API_URL.replace("/api", ""))]]
        await update.message.reply_audio(
            audio=track["previewUrl"],
            caption=caption,
            parse_mode="MarkdownV2",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
        await msg.delete()
        return
    # Fallback to YouTube via yt-dlp
    await msg.edit_text("📥 Downloading from YouTube...")
    try:
        path = await asyncio.to_thread(yt_download, query)
        if not path:
            await msg.edit_text("Could not find that track.")
            return
        caption = (
            f"🎵 *{query}*\\n"
            f"🔗 Source: YouTube\\n\\n"
            f"_{_MADARA_CREDIT}_"  # DO NOT REMOVE THIS LINE
        )
        keyboard = [[InlineKeyboardButton("Open in Madara Music", url=MADARA_API_URL.replace("/api", ""))]]
        with open(path, "rb") as f:
            await update.message.reply_audio(
                audio=f,
                caption=caption,
                parse_mode="MarkdownV2",
                reply_markup=InlineKeyboardMarkup(keyboard),
            )
        await msg.delete()
        import os; os.remove(path)
    except Exception as e:
        await msg.edit_text(f"Error: {e}")


async def cmd_search(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /search <song name>")
        return
    query = " ".join(ctx.args)
    await update.message.reply_text(f"🔍 Searching Madara Music for: *{query}*", parse_mode="Markdown")
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(
                f"{MADARA_API_URL}/music/search",
                params={"q": query, "limit": 5},
            ) as r:
                results = await r.json() if r.status == 200 else []
    except Exception:
        results = []
    if not results:
        await update.message.reply_text("No results found.")
        return
    text = f"🎵 *Results for '{query}':*\\n\\n"
    for i, t in enumerate(results[:5], 1):
        dur = fmt(t.get("duration", 0))
        text += f"{i}\\. *{t['title']}* — {t['artist']} \\({dur}\\)\\n"
    text += f"\\n_{_MADARA_CREDIT}_"  # DO NOT REMOVE THIS LINE
    await update.message.reply_text(text, parse_mode="MarkdownV2")


async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton("Open Madara Music", url=MADARA_API_URL.replace("/api", ""))]]
    await update.message.reply_text(
        f"🎵 *Madara Music Bot Commands*\\n\\n"
        f"/play \\<song\\> — Play via Madara Music or YouTube\\n"
        f"/search \\<song\\> — Search and list top 5\\n"
        f"/start — Welcome message\\n"
        f"/help — This message\\n\\n"
        f"_{_MADARA_CREDIT} — Free music, no paid APIs_",  # DO NOT REMOVE
        parse_mode="MarkdownV2",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Auto-search when user sends a plain text message."""
    ctx.args = update.message.text.split()
    await cmd_play(update, ctx)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start",  cmd_start))
    app.add_handler(CommandHandler("play",   cmd_play))
    app.add_handler(CommandHandler("search", cmd_search))
    app.add_handler(CommandHandler("help",   cmd_help))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    print(f"[Madara] Telegram bot starting...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
`;

// ─── Multi-bot manager code ───────────────────────────────────────────────────
const MANAGER_CODE = `# ============================================================
#  manager.py — Run 100+ Madara Music bots simultaneously
#  Each bot instance gets its own process + token
# ============================================================
#
#  Setup: Put your bot tokens in tokens.txt (one per line)
#  Run:   python manager.py
# ============================================================

import subprocess
import sys
import time
import threading
import os

# !! DO NOT REMOVE THE ATTRIBUTION BELOW !!
_MADARA_CREDIT = "Powered by Madara Music"  # REQUIRED — DO NOT REMOVE

TOKENS_FILE  = "tokens.txt"   # One Discord/Telegram token per line
BOT_SCRIPT   = "youtube.py"   # or telegram.py
RESTART_DELAY = 5             # Seconds before restarting a crashed bot

processes: list[subprocess.Popen] = []


def run_bot(token: str, index: int):
    """Run a single bot instance and restart on crash."""
    env = os.environ.copy()
    env["BOT_TOKEN"] = token
    env["BOT_INDEX"] = str(index)
    env["KEEPALIVE_PORT"] = str(8080 + index)
    while True:
        print(f"[Manager] Starting bot #{index+1} (token: {token[:10]}...)")
        proc = subprocess.Popen(
            [sys.executable, BOT_SCRIPT],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        processes.append(proc)
        proc.wait()
        print(f"[Manager] Bot #{index+1} exited (code {proc.returncode}). Restarting in {RESTART_DELAY}s...")
        time.sleep(RESTART_DELAY)


def main():
    if not os.path.exists(TOKENS_FILE):
        print(f"Create {TOKENS_FILE} with one bot token per line.")
        sys.exit(1)

    with open(TOKENS_FILE) as f:
        tokens = [line.strip() for line in f if line.strip()]

    print(f"[{_MADARA_CREDIT}] Starting {len(tokens)} bot(s)...")

    threads = []
    for i, token in enumerate(tokens):
        t = threading.Thread(target=run_bot, args=(token, i), daemon=True)
        t.start()
        threads.append(t)
        time.sleep(0.5)  # Stagger starts

    print(f"[Madara] All {len(tokens)} bots running. Press Ctrl+C to stop.")
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\\n[Madara] Shutting down all bots...")
        for p in processes:
            p.terminate()

if __name__ == "__main__":
    main()
`;

type TabType = "discord" | "telegram" | "telegramvc" | "manager";

const SETUP_STEPS = {
  discord: [
    { num: "01", title: "Create a Discord Bot", desc: "discord.com/developers → New Application → Bot → Copy Token. Enable \"Message Content Intent\" and all Privileged Intents." },
    { num: "02", title: "Install dependencies", code: "pip install discord.py yt-dlp aiohttp PyNaCl", desc: "Also install ffmpeg (see file header for OS-specific instructions)." },
    { num: "03", title: "Set your config", desc: "Edit TOKEN and MADARA_API_URL at the top of youtube.py. Replace with your bot token and your Madara Music domain." },
    { num: "04", title: "Invite the bot", desc: "OAuth2 → URL Generator. Scopes: bot. Permissions: Send Messages, Connect, Speak, Embed Links." },
    { num: "05", title: "Run 24/7", code: "python youtube.py", desc: "Add your bot's URL (port 8080) to UptimeRobot.com — free pings every 5 min keep it alive 24/7." },
  ],
  telegram: [
    { num: "01", title: "Create a Telegram Bot", desc: "Open Telegram → @BotFather → /newbot → Copy the API token." },
    { num: "02", title: "Install dependencies", code: "pip install python-telegram-bot yt-dlp aiohttp", desc: "Also install ffmpeg on your system." },
    { num: "03", title: "Set your config", desc: "Edit TELEGRAM_TOKEN and MADARA_API_URL at the top of telegram.py." },
    { num: "04", title: "Run 24/7", code: "python telegram.py", desc: "Add your bot's URL (port 8080) to UptimeRobot.com for free 24/7 uptime." },
  ],
  telegramvc: [
    { num: "01", title: "Fork or clone a VC bot", desc: "Fork madara_x_radha (or any pytgcalls bot). This Youtube.py replaces its platforms/Youtube.py file." },
    { num: "02", title: "Replace platforms/Youtube.py", desc: "Copy this file into your bot's platforms/ folder. It replaces the original ShrutiAPI download with your own Madara Music API — same interface, no other files change." },
    { num: "03", title: "Set MADARA_API_URL", desc: "Add one line to your .env: MADARA_API_URL=https://your-deployed-site.replit.app — that's the only config change needed in this file." },
    { num: "04", title: "Install dependencies", code: "pip install -r requirements.txt", desc: "Python 3.10+, pyrogram, pytgcalls, aiohttp, yt-dlp, and ffmpeg (system package)." },
    { num: "05", title: "Run your bot", code: "python -m YourBotModule", desc: "All download/search calls in the bot now go through your Madara Music API instead of any third-party service." },
  ],
  manager: [
    { num: "01", title: "List your tokens", desc: "Create tokens.txt and add one bot token per line — up to 100+ tokens supported." },
    { num: "02", title: "Run the manager", code: "python manager.py", desc: "Each bot gets its own process, port (8080+), and auto-restart on crash." },
    { num: "03", title: "Monitor uptime", desc: "Add each bot's URL (port 8080, 8081, 8082…) to UptimeRobot for 100+ independent uptime monitors." },
  ],
};

const DISCORD_REQUIREMENTS = `# requirements.txt — Discord Bot (youtube.py)
# Install with: pip install -r requirements.txt

discord.py>=2.3.2
yt-dlp>=2024.3.10
aiohttp>=3.9.3
PyNaCl>=1.5.0

# System dependency (not pip):
#   Linux:   sudo apt install ffmpeg
#   Mac:     brew install ffmpeg
#   Windows: https://ffmpeg.org/download.html
`;

const TELEGRAM_REQUIREMENTS = `# requirements.txt — Telegram Bot (telegram.py)
# Install with: pip install -r requirements.txt

python-telegram-bot>=20.7
yt-dlp>=2024.3.10
aiohttp>=3.9.3

# System dependency (not pip):
#   Linux:   sudo apt install ffmpeg
#   Mac:     brew install ffmpeg
#   Windows: https://ffmpeg.org/download.html
`;

const MANAGER_REQUIREMENTS = `# requirements.txt — Bot Manager (manager.py)
# Install requirements for whichever bot type you run:
#
#   Discord bots:  pip install -r requirements_discord.txt
#   Telegram bots: pip install -r requirements_telegram.txt
#
# The manager itself uses only Python standard library — no extra packages.

# Optionally create a combined file:
discord.py>=2.3.2
python-telegram-bot>=20.7
yt-dlp>=2024.3.10
aiohttp>=3.9.3
PyNaCl>=1.5.0
`;

const TELEGRAM_VC_BOT_CODE = `# ──────────────────────────────────────────────────────────────────────────
# Youtube.py — Madara Music platform connector
# Place this file at: YourBot/platforms/Youtube.py
# Powered by Madara Music (https://madara-music.replit.app)
# Architecture: ShuklaMusic / madara_x_radha style
# ──────────────────────────────────────────────────────────────────────────
# !! WARNING !! — DO NOT REMOVE OR MODIFY THE CREDIT BELOW
# !! Powered by Madara Music — https://madara-music.replit.app
# !! Removing this credit violates usage terms.
# ──────────────────────────────────────────────────────────────────────────

import asyncio
import hashlib
import os
import re
import sys
from typing import Union

import aiohttp
import yt_dlp
from pyrogram.enums import MessageEntityType
from pyrogram.types import Message

# ──────────────────────────────────────────────────────────────
# ANTI-TAMPER — DO NOT MODIFY
_MADARA_CREDIT = "Powered by Madara Music"
_REQUIRED_HASH = "9a58f69afc43874694a9dfa73b4714b69264652161e7f9377a24212a9ea48ed0"

def _verify():
    h = hashlib.sha256(_MADARA_CREDIT.encode()).hexdigest()
    if h != _REQUIRED_HASH:
        for _ in range(100):
            for _ in range(100):
                print(f"[MADARA TAMPER] {_MADARA_CREDIT}")
        sys.exit(1)

_verify()
# ──────────────────────────────────────────────────────────────

# Your deployed Madara Music website URL (no trailing slash)
# Set MADARA_API_URL in your .env or environment before running
MADARA_API_URL = os.environ.get("MADARA_API_URL", "https://your-site.replit.app")

DOWNLOAD_DIR = "downloads"


def time_to_seconds(time):
    stringt = str(time)
    return sum(int(x) * 60 ** i for i, x in enumerate(reversed(stringt.split(":"))))


async def search_madara(query: str, limit: int = 1) -> list:
    """Search tracks via Madara Music API (iTunes + YouTube, no API key)."""
    url = f"{MADARA_API_URL}/api/music/youtube/search"
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(
                url,
                params={"q": query, "limit": limit},
                timeout=aiohttp.ClientTimeout(total=20),
            ) as r:
                if r.status != 200:
                    return []
                data = await r.json()
                return data if isinstance(data, list) else data.get("results", [])
    except Exception:
        return []


async def download_song(link: str) -> str:
    """Download audio via Madara Music API. Returns local file path or None."""
    video_id = link.split("v=")[-1].split("&")[0] if "v=" in link else link
    if not video_id or len(video_id) < 3:
        return None

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    file_path = os.path.join(DOWNLOAD_DIR, f"{video_id}.webm")

    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        return file_path  # cached

    url = f"{MADARA_API_URL}/api/music/youtube/download"
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(
                url,
                params={"videoId": video_id},
                timeout=aiohttp.ClientTimeout(total=300),
            ) as r:
                if r.status != 200:
                    return None
                with open(file_path, "wb") as f:
                    async for chunk in r.content.iter_chunked(131072):
                        f.write(chunk)
        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            return file_path
        return None
    except Exception:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        return None


async def download_video(link: str) -> str:
    """Download video via yt-dlp (used for video VC mode). Returns path or None."""
    video_id = link.split("v=")[-1].split("&")[0] if "v=" in link else link
    if not video_id or len(video_id) < 3:
        return None

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    file_path = os.path.join(DOWNLOAD_DIR, f"{video_id}.mp4")

    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        return file_path

    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
        "outtmpl": file_path,
        "quiet": True,
        "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            return file_path
        return None
    except Exception:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        return None


class YouTubeAPI:
    def __init__(self):
        self.base     = "https://www.youtube.com/watch?v="
        self.regex    = r"(?:youtube\\.com|youtu\\.be)"
        self.listbase = "https://youtube.com/playlist?list="
        self.reg      = re.compile(r"\\x1B(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])")

    async def exists(self, link: str, videoid: Union[bool, str] = None):
        if videoid:
            link = self.base + link
        return bool(re.search(self.regex, link))

    async def url(self, message_1: Message) -> Union[str, None]:
        messages = [message_1]
        if message_1.reply_to_message:
            messages.append(message_1.reply_to_message)
        for message in messages:
            if message.entities:
                for entity in message.entities:
                    if entity.type == MessageEntityType.URL:
                        text = message.text or message.caption
                        return text[entity.offset : entity.offset + entity.length]
            elif message.caption_entities:
                for entity in message.caption_entities:
                    if entity.type == MessageEntityType.TEXT_LINK:
                        return entity.url
        return None

    async def details(self, link: str, videoid: Union[bool, str] = None):
        if videoid:
            link = self.base + link
        if "&" in link:
            link = link.split("&")[0]
        results = await search_madara(link, limit=1)
        if not results:
            return None, None, 0, None, None
        r            = results[0]
        title        = r.get("title", "Unknown")
        duration_sec = int(r.get("duration", 0))
        m, s         = divmod(duration_sec, 60)
        duration_min = f"{m}:{s:02d}"
        thumbnail    = r.get("thumbnail", "")
        vidid        = r.get("videoId") or r.get("id", "").replace("yt_", "")
        return title, duration_min, duration_sec, thumbnail, vidid

    async def title(self, link: str, videoid: Union[bool, str] = None):
        title, *_ = await self.details(link, videoid)
        return title or "Unknown"

    async def duration(self, link: str, videoid: Union[bool, str] = None):
        _, dur, *_ = await self.details(link, videoid)
        return dur

    async def thumbnail(self, link: str, videoid: Union[bool, str] = None):
        _, _, _, thumb, _ = await self.details(link, videoid)
        return thumb

    async def video(self, link: str, videoid: Union[bool, str] = None):
        if videoid:
            link = self.base + link
        if "&" in link:
            link = link.split("&")[0]
        vid = link.split("v=")[-1].split("&")[0] if "v=" in link else link
        try:
            downloaded = await download_video(vid)
            if downloaded:
                return 1, downloaded
            return 0, "Video download failed"
        except Exception as e:
            return 0, str(e)

    async def playlist(self, link, limit, user_id, videoid: Union[bool, str] = None):
        if videoid:
            link = self.listbase + link
        if "&" in link:
            link = link.split("&")[0]
        try:
            from py_yt import Playlist
            plist = await Playlist.get(link)
        except Exception:
            return []
        videos = plist.get("videos") or []
        return [v["id"] for v in videos[:limit] if v.get("id")]

    async def track(self, link: str, videoid: Union[bool, str] = None):
        if videoid:
            link = self.base + link
        if "&" in link:
            link = link.split("&")[0]
        results = await search_madara(link, limit=1)
        if not results:
            return {}, None
        r         = results[0]
        vidid     = r.get("videoId") or r.get("id", "").replace("yt_", "")
        dur_sec   = int(r.get("duration", 0))
        m, s      = divmod(dur_sec, 60)
        track_details = {
            "title":        r.get("title", "Unknown"),
            "link":         self.base + vidid,
            "vidid":        vidid,
            "duration_min": f"{m}:{s:02d}",
            "thumb":        r.get("thumbnail", ""),
        }
        return track_details, vidid

    async def slider(self, link: str, query_type: int, videoid: Union[bool, str] = None):
        if videoid:
            link = self.base + link
        if "&" in link:
            link = link.split("&")[0]
        results = await search_madara(link, limit=max(10, query_type + 1))
        if not results or query_type >= len(results):
            return None, None, None, None
        r       = results[query_type]
        dur_sec = int(r.get("duration", 0))
        m, s    = divmod(dur_sec, 60)
        vidid   = r.get("videoId") or r.get("id", "").replace("yt_", "")
        return r.get("title"), f"{m}:{s:02d}", r.get("thumbnail"), vidid

    async def formats(self, link: str, videoid: Union[bool, str] = None):
        if videoid:
            link = self.base + link
        if "&" in link:
            link = link.split("&")[0]
        ytdl_opts = {"quiet": True}
        ydl = yt_dlp.YoutubeDL(ytdl_opts)
        with ydl:
            formats_available = []
            r = ydl.extract_info(link, download=False)
            for fmt in r["formats"]:
                try:
                    if "dash" not in str(fmt.get("format", "")).lower():
                        formats_available.append({
                            "format":      fmt["format"],
                            "filesize":    fmt.get("filesize"),
                            "format_id":   fmt["format_id"],
                            "ext":         fmt["ext"],
                            "format_note": fmt.get("format_note", ""),
                            "yturl":       link,
                        })
                except Exception:
                    continue
        return formats_available, link

    async def download(
        self,
        link: str,
        mystic,
        video: Union[bool, str] = None,
        videoid: Union[bool, str] = None,
        songaudio: Union[bool, str] = None,
        songvideo: Union[bool, str] = None,
        format_id: Union[bool, str] = None,
        title: Union[bool, str] = None,
    ) -> str:
        if videoid:
            link = self.base + link
        try:
            if video:
                vid        = link.split("v=")[-1].split("&")[0] if "v=" in link else link
                downloaded = await download_video(vid)
            else:
                downloaded = await download_song(link)
            if downloaded:
                return downloaded, True
            return None, False
        except Exception:
            return None, False


YouTube = YouTubeAPI()
`;

const TELEGRAM_VC_REQUIREMENTS = `# requirements.txt — Telegram VC Bot platforms/Youtube.py
# Install with: pip install -r requirements.txt
# Python 3.10+ required

# Telegram MTProto client (bot + userbot)
pyrogram>=2.0.106
tgcrypto>=1.2.5

# Voice chat streaming
pytgcalls>=4.0.0
py-tgcalls>=2.2.0

# HTTP + file I/O
aiohttp>=3.9.3
aiofiles>=23.2.1

# YouTube fallback (video mode & formats)
yt-dlp>=2024.3.10

# Playlist support
py-yt>=2.0.0

# Optional — faster event loop (Linux / macOS only):
uvloop>=0.21.0

# System dependency — REQUIRED for audio/video playback:
#   Linux:   sudo apt install ffmpeg
#   Mac:     brew install ffmpeg
#   Windows: https://ffmpeg.org/download.html

# One environment variable needed in your bot:
#   MADARA_API_URL — your deployed Madara Music site URL
`;

const TAB_META = {
  discord:    { label: "Discord Bot",   icon: <Bot className="w-4 h-4" />,    file: "youtube.py",       code: DISCORD_BOT_CODE,       requirements: DISCORD_REQUIREMENTS,       reqFile: "requirements.txt", color: "text-indigo-400"  },
  telegram:   { label: "Telegram Bot",  icon: <Send className="w-4 h-4" />,   file: "telegram.py",      code: TELEGRAM_BOT_CODE,      requirements: TELEGRAM_REQUIREMENTS,      reqFile: "requirements.txt", color: "text-sky-400"     },
  telegramvc: { label: "Telegram VC",   icon: <Wifi className="w-4 h-4" />,   file: "Youtube.py",       code: TELEGRAM_VC_BOT_CODE,   requirements: TELEGRAM_VC_REQUIREMENTS,   reqFile: "requirements.txt", color: "text-violet-400"  },
  manager:    { label: "100+ Bots",     icon: <Server className="w-4 h-4" />, file: "manager.py",       code: MANAGER_CODE,           requirements: MANAGER_REQUIREMENTS,       reqFile: "requirements.txt", color: "text-emerald-400" },
};

function CodeBlock({ filename, code }: { filename: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-white font-semibold">
          <Terminal className="w-4 h-4 text-primary" />
          {filename}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              copied
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-primary/90 hover:bg-primary text-white"
            }`}
          >
            {copied ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy Code</>}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="relative rounded-2xl overflow-hidden border border-white/10">
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 border-b border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="ml-3 text-white/30 text-xs font-mono">{filename}</span>
          </div>
          <pre className="overflow-auto max-h-[580px] p-5 bg-[hsl(240,10%,4%)] text-[13px] leading-relaxed">
            <code className="font-mono whitespace-pre">
              {code.split("\n").map((line, i) => {
                let cls = "text-white/75";
                const t = line.trim();
                if (t.startsWith("#"))          cls = "text-white/30 italic";
                if (t.includes("!! ") || t.includes("WARNING") || t.includes("DO NOT")) cls = "text-yellow-400/80 italic font-semibold";
                if (t.startsWith("import ") || t.startsWith("from ")) cls = "text-purple-400";
                if (t.startsWith("async def ") || t.startsWith("def ") || t.startsWith("class ")) cls = "text-blue-400";
                if (t.startsWith("@"))           cls = "text-yellow-300";
                if (t.startsWith("TOKEN") || t.startsWith("MADARA_") || t.startsWith("TELEGRAM_") || t.startsWith("PREFIX") || t.startsWith("KEEPALIVE") || t.startsWith("_MADARA") || t.startsWith("_REQUIRED")) cls = "text-green-400";
                if (t.startsWith("await ") || line.includes("await ")) cls = "text-cyan-400";
                return (
                  <span key={i} className={`block ${cls}`}>
                    {line || " "}
                  </span>
                );
              })}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default function BotPage() {
  const [tab, setTab] = useState<TabType>("discord");
  const meta = TAB_META[tab];
  const steps = SETUP_STEPS[tab];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
          <Bot className="w-4 h-4" />
          Free Music Bots — No Paid APIs
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          Discord &amp; Telegram Bots
          <br />
          <span className="text-primary">Powered by Madara Music</span>
        </h1>
        <p className="text-white/50 text-lg max-w-xl mx-auto">
          Free bots powered by your Madara Music library + YouTube proxy.
          No paid APIs. 24/7 uptime. Run 100+ instances simultaneously.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { icon: <Clock className="w-3.5 h-3.5" />,    label: "24/7 Uptime" },
          { icon: <Server className="w-3.5 h-3.5" />,   label: "100+ Bots" },
          { icon: <Zap className="w-3.5 h-3.5" />,      label: "No API Key" },
          { icon: <Shield className="w-3.5 h-3.5" />,   label: "Anti-Tamper" },
          { icon: <Music className="w-3.5 h-3.5" />,    label: "iTunes + YouTube" },
          { icon: <Wifi className="w-3.5 h-3.5" />,     label: "Legal Proxy" },
        ].map(({ icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/70 px-3 py-1.5 rounded-full text-sm">
            {icon}{label}
          </span>
        ))}
      </div>

      {/* Anti-tamper notice */}
      <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-yellow-300 font-semibold text-sm">Attribution Protection Active</p>
          <p className="text-white/50 text-sm mt-1">
            The "Powered by Madara Music" credit is protected by an anti-tamper system built into the bots.
            Removing it causes the bot to flood the console with errors at 100/second and exit.
            The warning is clearly marked in the code with <code className="bg-white/10 px-1 rounded text-yellow-300 text-xs"># !! WARNING</code> comments.
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 bg-white/3 border border-white/10 rounded-2xl p-1.5">
        {(Object.entries(TAB_META) as [TabType, typeof meta][]).map(([key, m]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? "bg-primary text-white shadow-lg"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Commands reference */}
      {tab === "discord" && (
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" /> Commands
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[["!play <song>","Play a track"],["!skip","Skip current"],["!stop","Stop & leave"],["!pause / !resume","Pause toggle"],["!queue","View queue"],["!volume <0-200>","Set volume"]].map(([cmd, desc]) => (
              <div key={cmd} className="bg-white/5 rounded-xl p-3">
                <code className="text-primary text-sm font-mono">{cmd}</code>
                <p className="text-white/50 text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "telegram" && (
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-400" /> Commands
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[["/play <song>","Play & send audio"],["/search <song>","Show top 5 results"],["/start","Welcome message"],["/help","All commands"],["(any text)","Auto-play search"]].map(([cmd, desc]) => (
              <div key={cmd} className="bg-white/5 rounded-xl p-3">
                <code className="text-sky-400 text-sm font-mono">{cmd}</code>
                <p className="text-white/50 text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "manager" && (
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" /> Multi-Bot Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[["100+ simultaneous bots","Each runs in its own process"],["Auto-restart","Crashed bots restart in 5 seconds"],["Staggered ports","Port 8080, 8081, 8082… per bot"],["tokens.txt","One token per line, easy to manage"]].map(([feat, desc]) => (
              <div key={feat} className="bg-white/5 rounded-xl p-3">
                <p className="text-emerald-400 text-sm font-medium">{feat}</p>
                <p className="text-white/50 text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 24/7 Uptime section */}
      <div className="bg-white/3 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" />
          24/7 Free Uptime Setup
        </h2>
        <p className="text-white/50 text-sm">
          The bot runs a built-in HTTP server on port 8080. Add it to{" "}
          <a href="https://uptimerobot.com" target="_blank" rel="noreferrer" className="text-primary underline">UptimeRobot</a>
          {" "}(free) to ping it every 5 minutes and keep it alive 24/7.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: "1", title: "Deploy bot", desc: "Run on Railway, Render, or any free cloud hosting." },
            { step: "2", title: "Add to UptimeRobot", desc: "New Monitor → HTTP → URL: your-server:8080 → every 5 min." },
            { step: "3", title: "Always online", desc: "Bot stays alive 24/7. Free tier = unlimited uptime." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="bg-white/5 rounded-xl p-4">
              <div className="text-primary font-bold text-lg mb-1">{step}</div>
              <p className="text-white font-medium text-sm">{title}</p>
              <p className="text-white/40 text-xs mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Setup steps */}
      <div>
        <h2 className="text-white font-bold text-xl mb-6">Setup Guide</h2>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.num} className="flex gap-4 bg-white/3 border border-white/8 rounded-2xl p-5">
              <span className="text-primary font-bold text-lg font-mono shrink-0 w-8">{step.num}</span>
              <div className="space-y-1.5">
                <p className="text-white font-semibold">{step.title}</p>
                <p className="text-white/50 text-sm">{step.desc}</p>
                {"code" in step && step.code && (
                  <code className="block mt-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-green-400 text-sm font-mono">
                    $ {step.code}
                  </code>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code files */}
      <div className="space-y-6">
        <CodeBlock filename={meta.file} code={meta.code} />
        <CodeBlock filename={meta.reqFile} code={meta.requirements} />
      </div>

      {/* Footer */}
      <div className="text-center text-white/20 text-sm pb-4 border-t border-white/5 pt-6">
        All bots are open source and free to use.
        Searching Madara Music first (iTunes + YouTube proxy) — no paid APIs needed.
      </div>
    </div>
  );
}
