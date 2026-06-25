# Odyssey-Workspace

A local, zero-data-leak AI chat interface powered by **Ollama** running in a Docker environment.

This project packages both the backend Ollama engine and a beautiful, glassmorphic frontend UI into a unified Docker Compose setup.

---

## Quick Start (Docker Compose Options)

### Option A: Start Full Stack (Web Chat UI + Ollama Backend)
This builds and starts the frontend web server along with the Ollama container:

```bash
docker-compose up -d --build
```
- **Web Chat UI**: [http://localhost:3000](http://localhost:3000)
- **Ollama REST API**: [http://localhost:11434](http://localhost:11434)

### Option B: Start Ollama Only (For CLI / Terminal Chatting)
If you only want the Ollama engine without running the Nginx web frontend:

```bash
docker-compose -f docker-compose.llm.yml up -d
```
Once it's running, you can connect directly in your terminal using:
```bash
docker exec -it ollama ollama run llama3.2
```

---

On first startup of either option, three models will automatically be pulled in the background:
- `llama3.2` (Meta, 3B, general purpose)
- `gemma2:2b` (Google, 2B, lightweight)
- `tinyllama` (Ultra-fast, 1.1B, CPU-friendly)

---

## Command Line Interface (CLI) Guide

While you can manage and download models directly from the Web UI, you can also control Ollama directly from your terminal using standard Docker commands.

### 1. Pulling / Downloading Models
To download a new model from the Ollama library using the CLI, run:
```bash
# Pull the Mistral model (approx 4.1 GB)
docker exec -it ollama ollama pull mistral

# Pull the Python-coding specialist model
docker exec -it ollama ollama pull deepseek-coder
```

### 2. Listing Downloaded Models
To see all models currently downloaded and available on your local system:
```bash
docker exec -it ollama ollama list
```

### 3. Running a Model Directly in the Terminal
You can start an interactive chat session directly inside your shell command prompt without loading the website:
```bash
# Start a terminal chat session with Llama 3.2
docker exec -it ollama ollama run llama3.2
```
*Press `Ctrl + D` or type `/bye` to exit the terminal chat.*

### 4. Remove a Model
To delete a model and free up disk space:
```bash
docker exec -it ollama ollama rm tinyllama
```

### 5. Check Active/Loaded Models
To see which model is currently loaded in RAM/VRAM:
```bash
docker exec -it ollama ollama ps
```

### 6. View Ollama Service Logs
To view output and debug logs from the Ollama engine:
```bash
docker logs ollama -f
```

---

## Features
- **Zero Data Leakage**: Your conversations never leave your local machine.
- **Background Pre-loading**: Models are loaded into memory as soon as they are selected in the dropdown, avoiding response delay.
- **Curated Downloader**: Pull models directly from the UI dropdown or manually input any model from the official library.
- **Glassmorphism Design**: Sleek dark-mode interface with micro-animations and syntax highlighted markdown rendering.
