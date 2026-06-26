# Ollama Interactive Session — Slash Commands Guide

A complete reference for all `/` commands available inside an **Ollama interactive chat session**, plus real-world **DBA (Database Administrator)** usage examples.

---

## Starting an Interactive Session

All `/` commands below are used **inside** an active chat session. Start one with:

```bash
# Direct install
ollama run llama3.2

# Via Docker (this project)
docker exec -it ollama ollama run llama3.2
```

---

## Slash Command Reference

### `/set` — Configure Session Behaviour

The most powerful command. Changes model behaviour for the current session without restarting.

#### `/set system <prompt>`
Replaces the system prompt — the hidden instruction that defines the model's persona, role, and rules.

```
/set system You are a senior Oracle DBA with 20 years of experience. You answer only in SQL, PL/SQL, or shell commands unless asked to explain. Always prefer performance-safe queries with hints where appropriate.
```

#### `/set parameter <key> <value>`
Tunes the model's generation behaviour. Common parameters:

| Parameter | What it does | DBA-friendly value |
|---|---|---|
| `temperature` | Creativity vs precision (0=deterministic, 1=creative) | `0.2` for precise SQL |
| `num_ctx` | Context window size (tokens) | `8192` for long schemas |
| `top_p` | Nucleus sampling cutoff | `0.9` |
| `top_k` | Top-K sampling | `40` |
| `repeat_penalty` | Penalises repeated output | `1.1` |
| `num_predict` | Max tokens to generate | `2048` |
| `seed` | Fixed seed for reproducible output | `42` |

```
/set parameter temperature 0.1
/set parameter num_ctx 8192
/set parameter num_predict 2048
```

#### `/set format json`
Forces the model to respond **only** in valid JSON. Useful for parsing output programmatically.

```
/set format json
```
> Then ask: *"List the top 5 most expensive Oracle wait events as a JSON array"*

#### `/set noformat`
Removes the JSON format constraint and returns to free-form text output.

```
/set noformat
```

#### `/set verbose`
Prints token counts, generation speed (tokens/sec), and timing stats after every response. Essential for benchmarking.

```
/set verbose
```

#### `/set quiet` (or `/set noverbose`)
Disables the verbose timing stats.

```
/set quiet
```

#### `/set wordwrap`  /  `/set nowordwrap`
Enables or disables automatic word-wrapping for wide terminals.

```
/set wordwrap
/set nowordwrap
```

#### `/set history`  /  `/set nohistory`
Enables or disables saving chat history to `~/.ollama/history`.

```
/set nohistory
```

---

### `/show` — Inspect the Current Model

#### `/show info`
Displays model metadata: architecture, parameter count, quantisation level, context length, etc.

```
/show info
```

Example output:
```
Model
  architecture        llama
  parameters          3.2B
  context length      131072
  embedding length    3072
  quantization        Q4_K_M
```

#### `/show system`
Prints the **current system prompt** — useful to verify what persona/role is active.

```
/show system
```

#### `/show parameters`
Shows all currently active generation parameters (temperature, top_p, etc.).

```
/show parameters
```

#### `/show modelfile`
Prints the full **Modelfile** used to build the model — including the base model, system prompt, and parameters baked in at creation time.

```
/show modelfile
```

#### `/show template`
Shows the raw prompt template the model uses to structure conversation turns.

```
/show template
```

#### `/show license`
Displays the model's license text.

```
/show license
```

---

### `/save <name>` — Save Current Session as a New Model

Saves the **current system prompt + parameter overrides** as a reusable named model (a Modelfile snapshot). This is how you create persistent personas.

```
/save dba-oracle-expert
```

After saving, you can launch this persona directly in future sessions:

```bash
ollama run dba-oracle-expert
```

---

### `/load <name>` — Load a Saved Model or Session

Loads a previously saved model or session **without** exiting the current session.

```
/load dba-oracle-expert
```

You can also use this to hot-swap between models mid-conversation, e.g., switch from a general model to a coding specialist:

```
/load deepseek-coder
```

---

### `/clear` — Clear Conversation Context

Wipes the entire conversation history from the model's context window. The model "forgets" everything said so far. **The system prompt and parameters you set are preserved.**

```
/clear
```

Use this when:
- Starting a completely new topic in the same session
- Context window is getting full (check with `/set verbose`)
- The model is going off-track from accumulated chat drift

---

### `/bye` — Exit the Session

Cleanly exits the interactive session and returns to your shell prompt.

```
/bye
```

Alternatives: `Ctrl + D` or `/exit`

---

### `/help` — Show Help

Lists all available slash commands inside the session.

```
/help
```

---

### Multi-line Input with `"""`

Not a slash command, but essential for pasting large SQL blocks or schemas.

Start a multi-line block with `"""` and end it with another `"""`:

```
"""
CREATE TABLE orders (
  order_id   NUMBER PRIMARY KEY,
  customer   VARCHAR2(100),
  order_date DATE,
  total      NUMBER(10,2)
);
"""
```

---

## DBA Persona Examples

### Example 1: Senior Oracle DBA

```bash
docker exec -it ollama ollama run llama3.2
```

```
/set parameter temperature 0.1
/set parameter num_ctx 8192

/set system You are a senior Oracle Database Administrator (DBA) with 20+ years of experience in Oracle 12c, 19c, and 21c. You specialise in performance tuning, AWR/ASH analysis, index strategy, and RMAN backup and recovery. Always provide runnable SQL or PL/SQL. Prefer execution plan analysis using DBMS_XPLAN. When suggesting indexes, always check for existing ones first. Format SQL in uppercase keywords.
```

**Sample prompts:**
```
Show me how to find the top 10 SQL statements by elapsed time in AWR for the last 24 hours.
```
```
How do I rebuild a fragmented index online without locking the table?
```
```
Write a PL/SQL block to gather schema statistics for the SALES schema.
```

---

### Example 2: PostgreSQL Performance Tuning Expert

```
/set system You are a PostgreSQL DBA focused on query optimisation and performance tuning on PostgreSQL 15+. You always use EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) to diagnose queries. You prefer partial indexes, covering indexes, and pg_stat_statements for analysis. Never suggest dropping indexes without checking pg_stat_user_indexes first.

/set parameter temperature 0.15
/set parameter num_ctx 4096
```

**Sample prompts:**
```
I have a slow query on a table with 50 million rows. Here is the EXPLAIN output:

"""
Seq Scan on orders  (cost=0.00..982340.00 rows=50000000 width=72)
  Filter: (status = 'PENDING')
"""

What should I do?
```
```
How do I set up connection pooling with PgBouncer for a high-concurrency OLTP workload?
```

---

### Example 3: SQL Server DBA — Incident Response Mode

```
/set system You are a Microsoft SQL Server DBA responding to a production incident. The system is under heavy load. You respond with urgency and provide T-SQL commands to immediately diagnose and resolve blocking, deadlocking, or high CPU issues. Always check sys.dm_exec_requests, sys.dm_os_wait_stats, and sys.dm_exec_query_stats. Be concise — no lengthy explanations unless asked.

/set parameter temperature 0.05
```

**Sample prompts:**
```
Production SQL Server is at 100% CPU. Give me the T-SQL to find the culprit queries right now.
```
```
I'm seeing CXPACKET waits dominating. How do I tune MaxDOP for this OLTP server?
```
```
Write a blocking chain report using sys.dm_exec_requests and sys.dm_exec_sessions.
```

---

### Example 4: MySQL / MariaDB DBA

```
/set system You are a MySQL 8.0 and MariaDB DBA specialising in InnoDB performance, replication topology, and query optimisation. You use EXPLAIN FORMAT=JSON, SHOW ENGINE INNODB STATUS, and the Performance Schema extensively. Always check for missing indexes before suggesting query rewrites.

/set parameter temperature 0.2
```

**Sample prompts:**
```
How do I check for long-running transactions that might be blocking InnoDB purge?
```
```
Set up semi-synchronous replication between a primary and two replicas. Show all my.cnf settings.
```

---

### Example 5: Save and Reuse a DBA Persona

Once you have configured the perfect DBA session, **save it** so you never have to retype the setup:

```
/set system You are a senior DBA expert across Oracle, PostgreSQL, and SQL Server. You write production-quality SQL, identify performance bottlenecks, and recommend indexing strategies. You always validate destructive commands before running them.
/set parameter temperature 0.1
/set parameter num_ctx 8192
/save senior-dba
```

Next time, just run:

```bash
docker exec -it ollama ollama run senior-dba
```

---

## Quick Reference Cheat Sheet

| Command | What it does |
|---|---|
| `/set system <msg>` | Set the AI persona / role |
| `/set parameter temperature 0.1` | Tune generation parameters |
| `/set format json` | Force JSON-only output |
| `/set noformat` | Return to free-form output |
| `/set verbose` | Show token counts and speed |
| `/set quiet` | Hide timing stats |
| `/set wordwrap` | Enable line wrapping |
| `/set nohistory` | Don't save chat to disk |
| `/show info` | Model architecture and size |
| `/show system` | Current system prompt |
| `/show parameters` | Active generation parameters |
| `/show modelfile` | Full Modelfile definition |
| `/show template` | Prompt template structure |
| `/show license` | Model license text |
| `/save <name>` | Save session as a reusable model |
| `/load <name>` | Load a saved model into session |
| `/clear` | Wipe conversation history |
| `/bye` | Exit the session |
| `/help` | List all commands |
| `"""..."""` | Multi-line input block |

---

## Tips

- **`/clear` vs `/bye`** — `/clear` keeps your session alive (system + params preserved), `/bye` exits entirely.
- **`/save` persists forever** — saved models survive container restarts because they are stored in the `ollama_models` Docker volume.
- **Temperature for DBA work** — keep it between `0.05–0.2`. Higher values cause the model to "hallucinate" SQL syntax.
- **`num_ctx` for large schemas** — paste full DDL with `"""..."""` and set `num_ctx 8192` or higher so the model doesn't lose context mid-schema.
- **JSON mode for automation** — use `/set format json` when piping model output into scripts or `jq`.
