import { isAdmin } from "@/lib/admin-auth";
import { getSql } from "@/lib/db";
import { inflateRawSync } from "node:zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ZipEntry = { method: number; compressedSize: number; uncompressedSize: number; localOffset: number };
type ParsedCell = { value: string | number | null; style: number };
type ParsedRow = { index: number; cells: Map<number, ParsedCell> };
type RosterEntry = { date: string; name: string; sheet: string };
type SheetSummary = { name: string; days: number; firstDate: string | null; lastDate: string | null };

type ParseResult = {
  entries: RosterEntry[];
  sheets: SheetSummary[];
  warnings: string[];
};

async function authorized(request: Request) {
  if (await isAdmin(request)) return null;
  return Response.json({ error: "Niet bevoegd" }, { status: 401 });
}

function readZipDirectory(buffer: Buffer) {
  let eocd = -1;
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("Geen geldig XLSX-bestand");

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, ZipEntry>();
  let offset = centralOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Beschadigd XLSX-bestand");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    entries.set(name, { method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function unzipText(buffer: Buffer, entries: Map<string, ZipEntry>, name: string, required = true) {
  const entry = entries.get(name);
  if (!entry) {
    if (required) throw new Error(`Onderdeel ontbreekt in Excel: ${name}`);
    return "";
  }
  if (entry.uncompressedSize > 25_000_000) throw new Error("Excelbestand is te groot om veilig te verwerken");
  const offset = entry.localOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error("Beschadigd XLSX-bestand");
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(start, start + entry.compressedSize);
  let data: Buffer;
  if (entry.method === 0) data = compressed;
  else if (entry.method === 8) data = inflateRawSync(compressed);
  else throw new Error("Deze Excel-compressie wordt niet ondersteund");
  return data.toString("utf8");
}

function attr(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`))?.[1] ?? null;
}

function decodeXml(value: string) {
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return match;
  });
}

function columnNumber(ref: string) {
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  let result = 0;
  for (const char of letters) result = result * 26 + char.charCodeAt(0) - 64;
  return result;
}

function parseSharedStrings(xml: string) {
  if (!xml) return [] as string[];
  const result: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const text = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g), (part) => decodeXml(part[1])).join("");
    result.push(text);
  }
  return result;
}

function parseYellowStyles(stylesXml: string) {
  const bordersSection = stylesXml.match(/<borders\b[^>]*>([\s\S]*?)<\/borders>/)?.[1] ?? "";
  const borders = Array.from(bordersSection.matchAll(/<border\b[^>]*>[\s\S]*?<\/border>/g), (match) => match[0]);
  const yellowBorders = new Set<number>();
  borders.forEach((border, index) => {
    if (/rgb="(?:FF)?FFFF00"/i.test(border)) yellowBorders.add(index);
  });

  const xfsSection = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  const xfs = Array.from(xfsSection.matchAll(/<xf\b[^>]*(?:\/>|>)/g), (match) => match[0]);
  const yellowStyles = new Set<number>();
  xfs.forEach((xf, index) => {
    const borderId = Number(attr(xf, "borderId") ?? 0);
    if (yellowBorders.has(borderId)) yellowStyles.add(index);
  });
  if (!yellowStyles.size) throw new Error("Geen gele achterwacht-omlijning gevonden in dit Excelbestand");
  return yellowStyles;
}

function parseRows(sheetXml: string, sharedStrings: string[]) {
  const rows: ParsedRow[] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const index = Number(attr(rowMatch[1], "r") ?? 0);
    const cells = new Map<number, ParsedCell>();
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const cellTag = cellMatch[1];
      const ref = attr(cellTag, "r") ?? "";
      const col = columnNumber(ref);
      if (!col) continue;
      const style = Number(attr(cellTag, "s") ?? 0);
      const type = attr(cellTag, "t") ?? "";
      const body = cellMatch[2] ?? "";
      const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
      let value: string | number | null = null;
      if (type === "s" && raw !== "") value = sharedStrings[Number(raw)] ?? "";
      else if (type === "inlineStr") value = decodeXml(body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "");
      else if (type === "str") value = decodeXml(raw);
      else if (raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
      else if (raw !== "") value = decodeXml(raw);
      cells.set(col, { value, style });
    }
    rows.push({ index, cells });
  }
  return rows;
}

function excelDate(value: string | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const time = Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000;
    return new Date(time).toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  return null;
}

function parseRoster(buffer: Buffer): ParseResult {
  const zipEntries = readZipDirectory(buffer);
  const workbookXml = unzipText(buffer, zipEntries, "xl/workbook.xml");
  const relsXml = unzipText(buffer, zipEntries, "xl/_rels/workbook.xml.rels");
  const stylesXml = unzipText(buffer, zipEntries, "xl/styles.xml");
  const sharedStrings = parseSharedStrings(unzipText(buffer, zipEntries, "xl/sharedStrings.xml", false));
  const yellowStyles = parseYellowStyles(stylesXml);

  const relationships = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship\b([^>]*?)\/>/g)) {
    const id = attr(match[1], "Id");
    const target = attr(match[1], "Target");
    if (id && target) relationships.set(id, target);
  }

  const rawEntries: RosterEntry[] = [];
  const summaries: SheetSummary[] = [];
  const warnings: string[] = [];

  for (const sheetMatch of workbookXml.matchAll(/<sheet\b([^>]*?)\/>/g)) {
    const sheetName = decodeXml(attr(sheetMatch[1], "name") ?? "Werkblad");
    const relationId = attr(sheetMatch[1], "r:id");
    const target = relationId ? relationships.get(relationId) : null;
    if (!target) continue;
    const cleanTarget = target.replace(/^\/?xl\//, "").replace(/^\/+/, "");
    const sheetXml = unzipText(buffer, zipEntries, `xl/${cleanTarget}`);
    const rows = parseRows(sheetXml, sharedStrings);

    const header = rows.slice(0, 10).map((row) => {
      const names = Array.from(row.cells.entries()).filter(([col, cell]) => {
        if (col < 3 || typeof cell.value !== "string") return false;
        const value = cell.value.trim();
        return value.length > 1 && !/^(v|l|vak|d|-)$/i.test(value) && !/dienstwisseling/i.test(value);
      });
      return { row, names };
    }).sort((a, b) => b.names.length - a.names.length)[0];

    if (!header || header.names.length < 2) {
      warnings.push(`${sheetName}: namenrij niet herkend`);
      continue;
    }

    const people = new Map<number, string>();
    for (const [col, cell] of header.names) people.set(col, String(cell.value).trim());
    const sheetEntries: RosterEntry[] = [];
    let missing = 0;

    for (const row of rows) {
      if (row.index <= header.row.index) continue;
      const date = excelDate(row.cells.get(2)?.value ?? null);
      if (!date) continue;
      const matches = Array.from(people.entries()).filter(([col]) => yellowStyles.has(row.cells.get(col)?.style ?? -1));
      if (matches.length === 1) {
        sheetEntries.push({ date, name: matches[0][1], sheet: sheetName });
      } else if (matches.length > 1) {
        warnings.push(`${sheetName} ${date}: meerdere gele achterwachten gevonden`);
      } else {
        missing++;
      }
    }

    if (missing) warnings.push(`${sheetName}: ${missing} datum${missing === 1 ? "" : "s"} zonder gele achterwacht`);
    sheetEntries.sort((a, b) => a.date.localeCompare(b.date));
    rawEntries.push(...sheetEntries);
    summaries.push({
      name: sheetName,
      days: sheetEntries.length,
      firstDate: sheetEntries[0]?.date ?? null,
      lastDate: sheetEntries.at(-1)?.date ?? null,
    });
  }

  const byDate = new Map<string, RosterEntry>();
  const conflicts = new Set<string>();
  for (const entry of rawEntries) {
    const existing = byDate.get(entry.date);
    if (!existing) byDate.set(entry.date, entry);
    else if (existing.name !== entry.name) {
      conflicts.add(entry.date);
      warnings.push(`${entry.date}: conflict tussen ${existing.name} (${existing.sheet}) en ${entry.name} (${entry.sheet}); datum wordt niet geïmporteerd`);
    }
  }
  for (const date of conflicts) byDate.delete(date);

  const entries = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) throw new Error("Geen achterwachtdagen uit de gele omlijning kunnen uitlezen");
  return { entries, sheets: summaries, warnings };
}

export async function POST(request: Request) {
  const denied = await authorized(request); if (denied) return denied;
  try {
    const mode = new URL(request.url).searchParams.get("mode") === "import" ? "import" : "preview";
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Kies eerst een Excelbestand" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error: "Alleen .xlsx-bestanden worden ondersteund" }, { status: 400 });
    if (file.size > 10_000_000) return Response.json({ error: "Excelbestand is te groot (maximaal 10 MB)" }, { status: 400 });

    const parsed = parseRoster(Buffer.from(await file.arrayBuffer()));
    if (mode === "preview") return Response.json(parsed, { headers: { "cache-control": "no-store" } });

    const sql = getSql();
    const updatedBy = `Excel-import: ${file.name}`.slice(0, 160);
    for (const entry of parsed.entries) {
      await sql`
        INSERT INTO standby_roster (duty_date, person_name, updated_at, updated_by)
        VALUES (${entry.date}::date, ${entry.name}, NOW(), ${updatedBy})
        ON CONFLICT (duty_date) DO UPDATE
        SET person_name = EXCLUDED.person_name, updated_at = NOW(), updated_by = EXCLUDED.updated_by
      `;
    }
    return Response.json({ success: true, imported: parsed.entries.length, sheets: parsed.sheets, warnings: parsed.warnings }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rooster kon niet worden verwerkt";
    return Response.json({ error: message }, { status: 400 });
  }
}
