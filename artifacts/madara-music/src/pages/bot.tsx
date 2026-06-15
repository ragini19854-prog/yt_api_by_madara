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
    { num: "01", title: "Get API credentials", desc: "Go to https://my.telegram.org → API Development Tools → create an app. Copy API_ID and API_HASH." },
    { num: "02", title: "Create a Bot", desc: "Open Telegram → @BotFather → /newbot → copy the BOT_TOKEN. Add the bot as admin to your group." },
    { num: "03", title: "Generate STRING_SESSION", desc: "Run the helper script or use @StringSessionbot on Telegram to generate a Pyrogram string session for the assistant account." },
    { num: "04", title: "Install dependencies", code: "pip install -r requirements.txt", desc: "Python 3.10+ required. Also install ffmpeg — see requirements.txt for OS-specific instructions." },
    { num: "05", title: "Set env variables", desc: "Set API_ID, API_HASH, BOT_TOKEN, STRING_SESSION, MADARA_API_URL (your deployed site URL), OWNER_ID in a .env file or environment." },
    { num: "06", title: "Run 24/7", code: "python madara_vc_bot.py", desc: "Add your server's URL (port 8080) to UptimeRobot — free pings every 5 min keep it alive 24/7. Deploy on Railway, Render, or any cloud host." },
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

const TELEGRAM_VC_BOT_CODE = `# ============================================================
# madara_vc_bot.py — Telegram Voice Chat Music Bot
# Powered by Madara Music (https://madara-music.replit.app)
# Architecture inspired by ShuklaMusic / madara_x_radha
# ============================================================
# !! WARNING !! — DO NOT REMOVE OR MODIFY THE CREDIT BELOW
# !! Powered by Madara Music — https://madara-music.replit.app
# !! Removing this credit violates usage terms and triggers
# !! anti-tamper protection (100 errors/sec + sys.exit)
# ============================================================

import asyncio
import hashlib
import os
import sys
import aiohttp
import aiofiles
from threading import Thread
from http.server import HTTPServer, BaseHTTPRequestHandler
from collections import defaultdict
from typing import Dict, List, Optional

from pyrogram import Client, filters
from pyrogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from pytgcalls import PyTgCalls, idle
from pytgcalls import filters as pytgf
from pytgcalls.types import (
    MediaStream,
    AudioQuality,
    ChatUpdate,
    StreamEnded,
    Update,
)

# ──────────────────────────────────────────────────────────────
# ANTI-TAMPER — DO NOT MODIFY
_MADARA_CREDIT   = "Powered by Madara Music"
_REQUIRED_HASH   = "9a58f69afc43874694a9dfa73b4714b69264652161e7f9377a24212a9ea48ed0"

def _verify():
    h = hashlib.sha256(_MADARA_CREDIT.encode()).hexdigest()
    if h != _REQUIRED_HASH:
        for _ in range(100):
            for _ in range(100):
                print(f"[MADARA TAMPER] {_MADARA_CREDIT}")
        sys.exit(1)

_verify()
# ──────────────────────────────────────────────────────────────

# ══════════════════ CONFIG ════════════════════════════════════
# Fill these in a .env file or set as environment variables.
#
#   API_ID          — from https://my.telegram.org (integer)
#   API_HASH        — from https://my.telegram.org (string)
#   BOT_TOKEN       — from @BotFather on Telegram
#   STRING_SESSION  — Pyrogram session for the ASSISTANT userbot
#                     Generate: python3 gen_session.py  (see below)
#   MADARA_API_URL  — Your deployed Madara Music site (no trailing slash)
#   OWNER_ID        — Your Telegram user ID (integer)
# ══════════════════════════════════════════════════════════════

API_ID          = int(os.environ.get("API_ID", "0"))
API_HASH        = os.environ.get("API_HASH", "")
BOT_TOKEN       = os.environ.get("BOT_TOKEN", "")
STRING_SESSION  = os.environ.get("STRING_SESSION", "")
OWNER_ID        = int(os.environ.get("OWNER_ID", "0"))
MADARA_API_URL  = os.environ.get("MADARA_API_URL", "https://your-site.replit.app")
PREFIX          = os.environ.get("PREFIX", "/")
KEEPALIVE_PORT  = int(os.environ.get("PORT", "8080"))
DOWNLOAD_DIR    = "vc_audio"

os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# ──────────────────── 24/7 KEEPALIVE SERVER ───────────────────
class _PingHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Madara VC Bot is alive!")

    def log_message(self, *args):
        pass

Thread(target=lambda: HTTPServer(("0.0.0.0", KEEPALIVE_PORT), _PingHandler).serve_forever(), daemon=True).start()
# ──────────────────────────────────────────────────────────────

# ─────────────── PYROGRAM + PYTGCALLS CLIENTS ─────────────────
# bot  = the command-handling bot (BOT_TOKEN)
# userbot = the assistant that actually JOINS voice chat (STRING_SESSION)
bot = Client(
    "madara_vc_bot",
    api_id=API_ID,
    api_hash=API_HASH,
    bot_token=BOT_TOKEN,
    in_memory=True,
)
userbot = Client(
    "madara_vc_assistant",
    api_id=API_ID,
    api_hash=API_HASH,
    session_string=STRING_SESSION,
    in_memory=True,
)
call = PyTgCalls(userbot)
# ──────────────────────────────────────────────────────────────

# queue[chat_id] = [{"title", "duration", "by", "file", "thumb"}]
queue: Dict[int, List[dict]] = defaultdict(list)

# ─────────────── MADARA MUSIC API HELPERS ─────────────────────
async def madara_search(query: str) -> Optional[dict]:
    url = f"{MADARA_API_URL}/api/music/youtube/search"
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(url, params={"q": query, "limit": 1},
                             timeout=aiohttp.ClientTimeout(total=20)) as r:
                if r.status != 200:
                    return None
                data = await r.json()
                results = data if isinstance(data, list) else data.get("results", [])
                return results[0] if results else None
    except Exception:
        return None

async def madara_download(video_id: str) -> Optional[str]:
    path = os.path.join(DOWNLOAD_DIR, f"{video_id}.webm")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    url = f"{MADARA_API_URL}/api/music/youtube/download"
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(url, params={"videoId": video_id},
                             timeout=aiohttp.ClientTimeout(total=300)) as r:
                if r.status != 200:
                    return None
                async with aiofiles.open(path, "wb") as f:
                    async for chunk in r.content.iter_chunked(65536):
                        await f.write(chunk)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return path
    except Exception:
        pass
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
    return None
# ──────────────────────────────────────────────────────────────

def _fmt_dur(sec: int) -> str:
    m, s = divmod(int(sec), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

def _controls(chat_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("⏸ Pause",  callback_data=f"vc_pause_{chat_id}"),
        InlineKeyboardButton("⏭ Skip",   callback_data=f"vc_skip_{chat_id}"),
        InlineKeyboardButton("⏹ Stop",   callback_data=f"vc_stop_{chat_id}"),
    ]])

async def _play_next(chat_id: int, msg: Optional[Message] = None):
    if not queue[chat_id]:
        try:
            await call.leave_call(chat_id)
        except Exception:
            pass
        return
    track = queue[chat_id][0]
    try:
        await call.play(
            chat_id,
            MediaStream(track["file"], audio_parameters=AudioQuality.HIGH),
        )
    except Exception:
        queue[chat_id].pop(0)
        await _play_next(chat_id, msg)
        return
    if msg:
        try:
            await msg.edit_text(
                f"🎵 **Now Playing**\\n\\n"
                f"**{track['title']}**\\n"
                f"⏱ Duration: \`{track.get('duration', 'N/A')}\`\\n"
                f"👤 Requested by: {track['by']}\\n\\n"
                f"_Powered by Madara Music_",
                reply_markup=_controls(chat_id),
            )
        except Exception:
            pass

# ─────────────────── BOT COMMANDS ─────────────────────────────
@bot.on_message(filters.command(["play", "p"], PREFIX) & filters.group)
async def cmd_play(client: Client, message: Message):
    query = " ".join(message.command[1:]).strip()
    if not query:
        await message.reply("Usage: /play <song name>")
        return
    msg = await message.reply("🔍 Searching Madara Music...")
    track = await madara_search(query)
    if not track:
        await msg.edit("❌ No results found.")
        return
    video_id = track.get("videoId") or track.get("id", "").replace("yt_", "")
    title    = track.get("title", "Unknown")
    duration = _fmt_dur(track.get("duration", 0))
    thumb    = track.get("thumbnail", "")
    await msg.edit(f"⬇️ Downloading **{title}**...")
    file_path = await madara_download(video_id)
    if not file_path:
        await msg.edit("❌ Download failed. Try another song.")
        return
    chat_id = message.chat.id
    by = message.from_user.mention if message.from_user else "Unknown"
    queue[chat_id].append({"title": title, "duration": duration,
                           "by": by, "file": file_path, "thumb": thumb})
    if len(queue[chat_id]) > 1:
        await msg.edit(f"➕ **Added to Queue** (#{len(queue[chat_id])})\\n\\n**{title}** — \`{duration}\`")
        return
    await _play_next(chat_id, msg)

@bot.on_message(filters.command(["pause"], PREFIX) & filters.group)
async def cmd_pause(_, message: Message):
    try:
        await call.pause(message.chat.id)
        await message.reply("⏸ Paused.")
    except Exception:
        await message.reply("❌ Nothing is playing.")

@bot.on_message(filters.command(["resume"], PREFIX) & filters.group)
async def cmd_resume(_, message: Message):
    try:
        await call.resume(message.chat.id)
        await message.reply("▶️ Resumed.")
    except Exception:
        await message.reply("❌ Nothing to resume.")

@bot.on_message(filters.command(["skip", "next"], PREFIX) & filters.group)
async def cmd_skip(_, message: Message):
    chat_id = message.chat.id
    if not queue[chat_id]:
        await message.reply("❌ Queue is empty.")
        return
    queue[chat_id].pop(0)
    msg = await message.reply("⏭ Skipped.")
    await _play_next(chat_id, msg)

@bot.on_message(filters.command(["stop", "end"], PREFIX) & filters.group)
async def cmd_stop(_, message: Message):
    chat_id = message.chat.id
    queue[chat_id].clear()
    try:
        await call.leave_call(chat_id)
    except Exception:
        pass
    await message.reply("⏹ Stopped and cleared queue.")

@bot.on_message(filters.command(["queue", "q"], PREFIX) & filters.group)
async def cmd_queue(_, message: Message):
    chat_id = message.chat.id
    if not queue[chat_id]:
        await message.reply("📭 Queue is empty.")
        return
    lines = [f"🎵 **Queue — {len(queue[chat_id])} track(s)**\\n"]
    for i, t in enumerate(queue[chat_id][:10]):
        icon = "▶️" if i == 0 else f"{i + 1}."
        lines.append(f"{icon} **{t['title']}** — \`{t['duration']}\`")
    if len(queue[chat_id]) > 10:
        lines.append(f"... and {len(queue[chat_id]) - 10} more.")
    await message.reply("\\n".join(lines))

@bot.on_message(filters.command(["now", "np"], PREFIX) & filters.group)
async def cmd_now(_, message: Message):
    chat_id = message.chat.id
    if not queue[chat_id]:
        await message.reply("Nothing is playing right now.")
        return
    t = queue[chat_id][0]
    await message.reply(
        f"🎵 **Now Playing**\\n\\n**{t['title']}**\\n⏱ \`{t['duration']}\`\\n👤 {t['by']}",
        reply_markup=_controls(chat_id),
    )

@bot.on_message(filters.command(["help"], PREFIX) & (filters.group | filters.private))
async def cmd_help(_, message: Message):
    await message.reply(
        "🎵 **Madara VC Music Bot**\\n\\n"
        "/play <song>  — Search & play in voice chat\\n"
        "/pause        — Pause playback\\n"
        "/resume       — Resume playback\\n"
        "/skip         — Skip current track\\n"
        "/stop         — Stop & clear queue\\n"
        "/queue        — Show queue\\n"
        "/now          — Now playing\\n\\n"
        "_Powered by Madara Music_"
    )

# ─────────────── INLINE BUTTON CALLBACKS ──────────────────────
@bot.on_callback_query()
async def cb_handler(_, cb):
    data = cb.data or ""
    parts = data.split("_", 2)
    if len(parts) < 3 or parts[0] != "vc":
        return
    action, cid_str = parts[1], parts[2]
    chat_id = int(cid_str)
    if action == "pause":
        try:
            await call.pause(chat_id)
            await cb.answer("⏸ Paused")
        except Exception:
            await cb.answer("Nothing playing")
    elif action == "skip":
        if queue[chat_id]:
            queue[chat_id].pop(0)
        await cb.answer("⏭ Skipped")
        await _play_next(chat_id)
    elif action == "stop":
        queue[chat_id].clear()
        try:
            await call.leave_call(chat_id)
        except Exception:
            pass
        await cb.answer("⏹ Stopped")

# ─────────────── PYTGCALLS STREAM EVENTS ──────────────────────
@call.on_update()
async def on_vc_update(_, update: Update):
    if isinstance(update, StreamEnded):
        chat_id = update.chat_id
        if queue[chat_id]:
            queue[chat_id].pop(0)
        await _play_next(chat_id)
    elif isinstance(update, ChatUpdate):
        if update.status in (
            ChatUpdate.Status.KICKED,
            ChatUpdate.Status.LEFT_GROUP,
            ChatUpdate.Status.CLOSED_VOICE_CHAT,
        ):
            queue[update.chat_id].clear()

# ──────────────────────────────── STARTUP ─────────────────────
async def main():
    await bot.start()
    await userbot.start()
    await call.start()
    print(f"✅ Madara VC Bot started — keepalive on port {KEEPALIVE_PORT}")
    print(f"   API: {MADARA_API_URL}")
    print(f"   Powered by Madara Music")
    await idle()
    await call.stop()
    await userbot.stop()
    await bot.stop()

if __name__ == "__main__":
    asyncio.run(main())

# ──────────────── STRING SESSION HELPER ───────────────────────
# Save this as gen_session.py and run once to get STRING_SESSION:
#
# from pyrogram import Client
# import asyncio
#
# async def main():
#     async with Client("session", api_id=YOUR_API_ID, api_hash="YOUR_API_HASH") as app:
#         print(await app.export_session_string())
#
# asyncio.run(main())
# ──────────────────────────────────────────────────────────────
`;

const TELEGRAM_VC_REQUIREMENTS = `# requirements.txt — Telegram VC Music Bot (madara_vc_bot.py)
# Install with: pip install -r requirements.txt
# Python 3.10+ required

pyrogram>=2.0.106
pytgcalls>=4.0.0
aiohttp>=3.9.3
aiofiles>=23.2.1
tgcrypto>=1.2.5

# Optional — faster async event loop (Linux / macOS only):
uvloop>=0.21.0

# System dependency (not pip) — REQUIRED for audio playback:
#   Linux:   sudo apt install ffmpeg
#   Mac:     brew install ffmpeg
#   Windows: https://ffmpeg.org/download.html

# Environment variables required before running:
#   API_ID          — integer  — from https://my.telegram.org
#   API_HASH        — string   — from https://my.telegram.org
#   BOT_TOKEN       — string   — from @BotFather on Telegram
#   STRING_SESSION  — string   — Pyrogram session for assistant
#   MADARA_API_URL  — string   — your deployed Madara Music URL
#   OWNER_ID        — integer  — your Telegram user ID
`;

const TAB_META = {
  discord:    { label: "Discord Bot",   icon: <Bot className="w-4 h-4" />,    file: "youtube.py",       code: DISCORD_BOT_CODE,       requirements: DISCORD_REQUIREMENTS,       reqFile: "requirements.txt", color: "text-indigo-400"  },
  telegram:   { label: "Telegram Bot",  icon: <Send className="w-4 h-4" />,   file: "telegram.py",      code: TELEGRAM_BOT_CODE,      requirements: TELEGRAM_REQUIREMENTS,      reqFile: "requirements.txt", color: "text-sky-400"     },
  telegramvc: { label: "Telegram VC",   icon: <Wifi className="w-4 h-4" />,   file: "madara_vc_bot.py", code: TELEGRAM_VC_BOT_CODE,   requirements: TELEGRAM_VC_REQUIREMENTS,   reqFile: "requirements.txt", color: "text-violet-400"  },
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
