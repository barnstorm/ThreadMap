#!/usr/bin/env node
import "dotenv/config";
import {
  EDGE_TYPES,
  NODE_TYPES,
  VIEWS,
  type EdgeType,
  type GraphNode,
  type NodeType,
  isEdgeType,
  isNodeType,
} from "@threadmap/shared";
import { closeDriver, withSession } from "./db/driver.js";
import { createEdge, deleteEdge, listEdges } from "./repositories/edgeRepo.js";
import { createNode, deleteNode, getNode, listNodes, updateNode } from "./repositories/nodeRepo.js";
import { nodeReadiness } from "./repositories/readinessRepo.js";
import { runView } from "./repositories/viewRepo.js";

/**
 * threadmap — a small Unix-style CLI over the ThreadMap graph.
 *
 * Plain text: TSV on stdout, errors on stderr, non-zero exit on failure.
 * `--json` switches any command to JSON-lines (one object per line) for jq.
 * No colors, no TUI — pipe and grep it.
 */

const out = (line = ""): void => {
  process.stdout.write(line + "\n");
};
const tsv = (...fields: unknown[]): void => out(fields.map((f) => (f == null ? "" : String(f))).join("\t"));
const die = (msg: string): never => {
  process.stderr.write(`threadmap: ${msg}\n`);
  process.exit(1);
};

/** Split argv into positionals and flags (--k v, --k=v, --bool). */
function parseArgs(argv: string[]): { pos: string[]; flags: Record<string, string | boolean> } {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1]!.startsWith("--")) flags[a.slice(2)] = argv[++i]!;
      else flags[a.slice(2)] = true;
    } else {
      pos.push(a);
    }
  }
  return { pos, flags };
}

function nodeLine(n: GraphNode): void {
  tsv(n.id, n.type, n.title);
}

/** Resolve a token to a node id: exact id first, then exact title (must be unique). */
async function resolveNode(token: string): Promise<string> {
  const byId = await getNode(token);
  if (byId) return byId.id;
  const matches = (await listNodes({ q: token })).filter((n) => n.title === token);
  if (matches.length === 1) return matches[0]!.id;
  if (matches.length === 0) die(`no node matching "${token}"`);
  return die(`"${token}" is ambiguous (${matches.length} nodes); use an id`);
}

function matchNodeType(s: string): NodeType {
  const hit = NODE_TYPES.find((t) => t.toLowerCase() === s.toLowerCase());
  return hit ?? (die(`unknown node type "${s}" (one of: ${NODE_TYPES.join(", ")})`) as never);
}

function matchEdgeType(s: string): EdgeType {
  const up = s.toUpperCase();
  return isEdgeType(up) ? up : (die(`unknown edge type "${s}" (one of: ${EDGE_TYPES.join(", ")})`) as never);
}

/** Turn `key=value`, `ws.key=value`, `smart.key=value` tokens into an update payload. */
function parseAssignments(tokens: string[]): Record<string, unknown> {
  const top: Record<string, unknown> = {};
  const ws: Record<string, unknown> = {};
  const smart: Record<string, unknown> = {};
  for (const tok of tokens) {
    const eq = tok.indexOf("=");
    if (eq === -1) die(`expected key=value, got "${tok}"`);
    const key = tok.slice(0, eq);
    const raw = tok.slice(eq + 1);
    const value: unknown = raw === "" ? null : key === "tags" ? raw.split(",").map((s) => s.trim()) : raw;
    if (key.startsWith("smart.")) smart[key.slice(6)] = value;
    else if (key.startsWith("ws.")) ws[key.slice(3)] = value;
    else top[key] = value;
  }
  if (Object.keys(smart).length) ws.smart = smart;
  if (Object.keys(ws).length) top.workstream = ws;
  return top;
}

const HELP = `threadmap — Unix-style interface to the ThreadMap graph (talks straight to Neo4j)

USAGE
  threadmap <command> [args] [--json]

NODES
  add <type> <title...>          Create a node; prints: id  type  title
  ls [--type T] [--q TEXT]       List nodes (TSV: id  type  title)
  show <id|title>                Print a node's fields (key  value)
  set <id|title> key=value ...   Update fields. Empty value clears. ws.<f>=, smart.<f>= for workstreams
  rm <id|title>                  Delete a node and its edges

EDGES
  link <src> <TYPE> <dst>        Create an edge (src/dst by id or exact title); prints edge id
  unlink <edgeId>                Delete an edge
  edges [id|title]               List edges (TSV: edgeId  TYPE  srcId  dstId), optionally for one node

REVIEW
  views                          List saved views (id  name)
  view <view-id>                 Run a saved view (TSV rows; groups prefixed by key)
  readiness <id|title>           Delegation-readiness checklist for a workstream
  neighbors <id|title> [--depth N]

RAW
  query <cypher>                 Run Cypher; prints each record as a JSON line
  types                          List node and edge types
  completion bash|zsh            Print a shell completion script

Add --json to most commands for JSON-lines output.

COMPLETION
  bash:  source <(threadmap completion bash)
  zsh:   source <(threadmap completion zsh)`;

const COMMANDS = "add ls show set rm link unlink edges views view readiness neighbors query types help completion";

function completionScript(shell: string): string {
  const views = VIEWS.map((v) => v.id).join(" ");
  const nodes = NODE_TYPES.join(" ");
  const edges = EDGE_TYPES.join(" ");
  if (shell === "bash") {
    return `# threadmap bash completion — source <(threadmap completion bash)
_threadmap() {
  local cur prev; cur="\${COMP_WORDS[COMP_CWORD]}"; prev="\${COMP_WORDS[COMP_CWORD-1]}"
  if [ "$COMP_CWORD" -eq 1 ]; then COMPREPLY=( $(compgen -W "${COMMANDS}" -- "$cur") ); return; fi
  case "\${COMP_WORDS[1]}" in
    view) COMPREPLY=( $(compgen -W "${views}" -- "$cur") );;
    add)  [ "$COMP_CWORD" -eq 2 ] && COMPREPLY=( $(compgen -W "${nodes}" -- "$cur") );;
    link) [ "$COMP_CWORD" -eq 3 ] && COMPREPLY=( $(compgen -W "${edges}" -- "$cur") );;
    completion) COMPREPLY=( $(compgen -W "bash zsh" -- "$cur") );;
  esac
}
complete -F _threadmap threadmap`;
  }
  if (shell === "zsh") {
    return `# threadmap zsh completion — source <(threadmap completion zsh)
_threadmap() {
  if (( CURRENT == 2 )); then compadd ${COMMANDS}; return; fi
  case "\${words[2]}" in
    view) compadd ${views};;
    add)  (( CURRENT == 3 )) && compadd ${nodes};;
    link) (( CURRENT == 4 )) && compadd ${edges};;
    completion) compadd bash zsh;;
  esac
}
compdef _threadmap threadmap`;
  }
  return die(`unknown shell "${shell}" (bash|zsh)`) as never;
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  const { pos, flags } = parseArgs(rest);
  const json = Boolean(flags.json);

  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      out(HELP);
      return;

    case "types":
      if (json) out(JSON.stringify({ nodeTypes: NODE_TYPES, edgeTypes: EDGE_TYPES }));
      else {
        out("# node types"); NODE_TYPES.forEach((t) => out(t));
        out("# edge types"); EDGE_TYPES.forEach((t) => out(t));
      }
      return;

    case "add": {
      const [type, ...titleParts] = pos;
      if (!type || titleParts.length === 0) die("usage: add <type> <title...>");
      const node = await createNode({ type: matchNodeType(type!), title: titleParts.join(" ") });
      if (json) out(JSON.stringify(node));
      else nodeLine(node);
      return;
    }

    case "ls": {
      const type = typeof flags.type === "string" ? flags.type : undefined;
      if (type && !isNodeType(type)) die(`unknown node type "${type}"`);
      const nodes = await listNodes({ type: type as NodeType | undefined, q: typeof flags.q === "string" ? flags.q : undefined });
      if (json) nodes.forEach((n) => out(JSON.stringify(n)));
      else nodes.forEach(nodeLine);
      return;
    }

    case "show": {
      if (!pos[0]) die("usage: show <id|title>");
      const node = await getNode(await resolveNode(pos[0]!));
      if (!node) die("not found");
      if (json) out(JSON.stringify(node));
      else for (const [k, v] of Object.entries(flatten(node!))) tsv(k, v);
      return;
    }

    case "set": {
      const [token, ...assigns] = pos;
      if (!token || assigns.length === 0) die("usage: set <id|title> key=value ...");
      const node = await updateNode(await resolveNode(token!), parseAssignments(assigns));
      if (!node) die("not found");
      if (json) out(JSON.stringify(node));
      else nodeLine(node!);
      return;
    }

    case "rm": {
      if (!pos[0]) die("usage: rm <id|title>");
      const ok = await deleteNode(await resolveNode(pos[0]!));
      if (!ok) die("not found");
      return;
    }

    case "link": {
      const [src, type, dst] = pos;
      if (!src || !type || !dst) die("usage: link <src> <TYPE> <dst>");
      const edge = await createEdge({
        type: matchEdgeType(type!),
        source: await resolveNode(src!),
        target: await resolveNode(dst!),
      });
      if (json) out(JSON.stringify(edge));
      else out(edge.id);
      return;
    }

    case "unlink": {
      if (!pos[0]) die("usage: unlink <edgeId>");
      const ok = await deleteEdge(pos[0]!);
      if (!ok) die("edge not found");
      return;
    }

    case "edges": {
      const all = await listEdges();
      const filtered = pos[0] ? await filterEdges(all, pos[0]!) : all;
      if (json) filtered.forEach((e) => out(JSON.stringify(e)));
      else filtered.forEach((e) => tsv(e.id, e.type, e.source, e.target));
      return;
    }

    case "views":
      VIEWS.forEach((v) => (json ? out(JSON.stringify(v)) : tsv(v.id, v.name)));
      return;

    case "view": {
      if (!pos[0]) die("usage: view <view-id>");
      const result = await runView(pos[0]!).catch((e) => die((e as Error).message));
      if (json) {
        out(JSON.stringify(result));
        return;
      }
      result.items?.forEach(nodeLine);
      result.groups?.forEach((g) => g.items.forEach((n) => tsv(g.key, n.type, n.title, n.id)));
      result.graph?.nodes.forEach(nodeLine);
      return;
    }

    case "readiness": {
      if (!pos[0]) die("usage: readiness <id|title>");
      const report = await nodeReadiness(await resolveNode(pos[0]!));
      if (!report) die("not a workstream (or not found)");
      if (json) out(JSON.stringify(report));
      else {
        tsv(`${report!.metCount}/${report!.total}`, report!.ready ? "READY" : "not ready");
        report!.requirements.forEach((r) => tsv(r.met ? "[x]" : "[ ]", r.label));
      }
      return;
    }

    case "neighbors": {
      if (!pos[0]) die("usage: neighbors <id|title> [--depth N]");
      const depth = flags.depth ? Number(flags.depth) : 1;
      const id = await resolveNode(pos[0]!);
      const { getNeighborhood } = await import("./repositories/nodeRepo.js");
      const hood = await getNeighborhood(id, depth);
      if (!hood) die("not found");
      if (json) out(JSON.stringify(hood));
      else {
        hood!.nodes.filter((n) => n.id !== id).forEach(nodeLine);
      }
      return;
    }

    case "completion": {
      if (!pos[0]) die("usage: completion bash|zsh");
      out(completionScript(pos[0]!));
      return;
    }

    case "query": {
      const cypher = pos.join(" ");
      if (!cypher) die("usage: query '<cypher>'");
      const records = await withSession(async (s) => (await s.run(cypher)).records);
      records.forEach((r) => out(JSON.stringify(r.toObject())));
      return;
    }

    default:
      die(`unknown command "${cmd}" (try: threadmap help)`);
  }
}

/** Flatten a node into key/value lines for `show`. */
function flatten(node: GraphNode): Record<string, unknown> {
  const { workstream, ...rest } = node;
  const flat: Record<string, unknown> = { ...rest };
  if (Array.isArray(flat.tags)) flat.tags = (flat.tags as string[]).join(",");
  if (workstream) {
    const { smart, ...ws } = workstream;
    for (const [k, v] of Object.entries(ws)) flat[`ws.${k}`] = v;
    if (smart) for (const [k, v] of Object.entries(smart)) flat[`smart.${k}`] = v;
  }
  return flat;
}

async function filterEdges(all: Awaited<ReturnType<typeof listEdges>>, token: string) {
  const id = await resolveNode(token);
  return all.filter((e) => e.source === id || e.target === id);
}

main()
  .catch((err) => {
    process.stderr.write(`threadmap: ${(err as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDriver());
