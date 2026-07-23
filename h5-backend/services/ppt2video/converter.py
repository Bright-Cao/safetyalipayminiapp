import os
import sys
import argparse
import asyncio
import subprocess
import shutil
import tempfile
import json
from pptx import Presentation
from pdf2image import convert_from_path
import edge_tts
from moviepy import ImageClip, AudioFileClip, concatenate_videoclips

def report_progress(percent, status):
    """Outputs JSON progress line for Node.js process listener."""
    print(json.dumps({"progress": percent, "status": status}), flush=True)

def extract_notes(pptx_path):
    """Extracts speaker notes from PPTX slides."""
    prs = Presentation(pptx_path)
    notes = []
    for idx, slide in enumerate(prs.slides):
        note_text = ""
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            note_text = slide.notes_slide.notes_text_frame.text.strip()
        if not note_text:
            # Fallback to slide title or generic text if no note exists
            title = f"第{idx+1}页"
            if slide.shapes.title and slide.shapes.title.text:
                title = slide.shapes.title.text.strip()
            note_text = title
        notes.append(note_text)
    return notes

def convert_pptx_to_pdf(pptx_path, output_dir):
    """Converts PPTX to PDF using LibreOffice headless mode."""
    report_progress(15, "正在使用 LibreOffice 转换为 PDF...")
    soffice_bin = shutil.which("soffice") or shutil.which("libreoffice") or "/usr/bin/soffice"
    if not os.path.exists(soffice_bin) and not shutil.which(soffice_bin):
        raise RuntimeError("LibreOffice (soffice) 未在服务器上找到")

    cmd = [soffice_bin, "--headless", "--convert-to", "pdf", "--outdir", output_dir, pptx_path]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if res.returncode != 0:
        raise RuntimeError(f"LibreOffice 转换失败: {res.stderr}")

    base_name = os.path.splitext(os.path.basename(pptx_path))[0]
    pdf_path = os.path.join(output_dir, base_name + ".pdf")
    if not os.path.exists(pdf_path):
        # Fallback check for any generated pdf
        for f in os.listdir(output_dir):
            if f.endswith(".pdf"):
                return os.path.join(output_dir, f)
        raise FileNotFoundError("未查找到生成的 PDF 文件")
    return pdf_path

def convert_pdf_to_images(pdf_path, output_dir):
    """Converts PDF pages to PNG images using pdf2image."""
    report_progress(35, "正在将 PDF 渲染为高清图片...")
    images = convert_from_path(pdf_path, dpi=150)
    image_paths = []
    for i, img in enumerate(images):
        img_path = os.path.join(output_dir, f"slide_{i+1}.png")
        img.save(img_path, "PNG")
        image_paths.append(img_path)
    return image_paths

async def generate_audio_files(notes, output_dir, voice="zh-CN-XiaoxiaoNeural", rate="+0%"):
    """Generates MP3 audio files for each slide note using edge-tts."""
    report_progress(55, "正在生成语音配音...")
    audio_paths = []
    total = len(notes)
    for i, note in enumerate(notes):
        audio_path = os.path.join(output_dir, f"audio_{i+1}.mp3")
        text = note if note.strip() else f"第 {i+1} 页幻灯片"
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        await communicate.save(audio_path)
        audio_paths.append(audio_path)
        prog = 55 + int((i + 1) / total * 20)
        report_progress(prog, f"已生成第 {i+1}/{total} 页配音")
    return audio_paths

def compose_video(images, audio_files, output_path):
    """Composes MP4 video from slide images and audio files using MoviePy."""
    report_progress(80, "正在合成 MP4 视频...")
    clips = []
    for img_path, audio_path in zip(images, audio_files):
        audio_clip = AudioFileClip(audio_path)
        duration = max(audio_clip.duration, 1.0)
        img_clip = ImageClip(img_path).with_duration(duration)
        img_clip = img_clip.with_audio(audio_clip)
        clips.append(img_clip)

    final_clip = concatenate_videoclips(clips, method="compose")
    final_clip.write_videofile(
        output_path,
        fps=24,
        codec="libx264",
        audio_codec="aac",
        preset="ultrafast",
        logger=None
    )

    # Close all clips
    final_clip.close()
    for c in clips:
        c.close()

    report_progress(100, "视频合成完成！")

async def process_ppt_to_video(pptx_path, output_path, voice="zh-CN-XiaoxiaoNeural", rate="+0%"):
    temp_dir = tempfile.mkdtemp(prefix="ppt2video_")
    try:
        report_progress(5, "正在解析 PPT 幻灯片与备注...")
        notes = extract_notes(pptx_path)
        if not notes:
            raise ValueError("PPT 文件中未找到幻灯片内容")

        pdf_path = convert_pptx_to_pdf(pptx_path, temp_dir)
        images = convert_pdf_to_images(pdf_path, temp_dir)
        audio_files = await generate_audio_files(notes, temp_dir, voice=voice, rate=rate)

        if len(images) != len(audio_files):
            raise ValueError("幻灯片页数与音频数量不一致")

        compose_video(images, audio_files, output_path)

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def main():
    parser = argparse.ArgumentParser(description="Linux PPT to Video Converter Service")
    parser.add_argument("pptx_path", help="输入 PPTX 文件路径")
    parser.add_argument("--output", required=True, help="输出 MP4 视频路径")
    parser.add_argument("--voice", default="zh-CN-XiaoxiaoNeural", help="TTS 发音人")
    parser.add_argument("--rate", default="+0%", help="语速调整")

    args = parser.parse_args()

    try:
        asyncio.run(process_ppt_to_video(args.pptx_path, args.output, args.voice, args.rate))
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
