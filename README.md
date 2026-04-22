# TiefbauPorte

Vor-Ort-Check App für BImA LIS-Rollout, Union E GmbH.

## Struktur

```
/
├── index.html              Landing-Seite mit Versionsauswahl
├── v5/
│   └── TiefbauPorte.html   Stabile Vorgängerversion (bisher einzige Datei)
└── v6/
    ├── index.html          Haupt-HTML
    ├── app.css             Styles
    ├── app.js              Bootstrapping
    └── modules/
        ├── constants.js    Kataloge, OF-Definitionen, Emojis
        ├── storage.js      LocalStorage + v5→v6 Migration
        ├── ui.js           Modal, Banner, Format-Helpers, Photos
        ├── calc.js         Berechnungen (Distanz, Totals)
        ├── render.js       Karten-Rendering (Pins, Trassen, Legende)
        ├── mode.js         Edit/View + Map-Mode (pin/trace/drag)
        ├── catalog.js      Asset-Katalog-Dialoge + Emoji-Picker
        ├── objects.js      Info- und Edit-Dialog für Assets
        └── traces.js       Trassen-Zeichnung + Basis-Segment-Editor
```

## Deployment

Die App läuft rein clientseitig. Keine Build-Tools nötig.

**Option 1: GitHub Pages** (bei Enterprise-Lizenz für private Repos)
- Repo Settings → Pages → Source: `main` / `/` (root)
- Öffne die GitHub-Pages-URL → Landing-Seite
- Landing verlinkt zu `v5/` und `v6/`

**Option 2: Lokal**
- Repo als ZIP herunterladen und lokal entpacken
- `index.html` im Browser öffnen

**Option 3: Internes Hosting**
- Alle Dateien auf einen internen Webserver hochladen, Pfade bleiben relativ.

## Datenspeicherung

LocalStorage im Browser. v6 nutzt Key `tbp_v6`. Bei erstem Start der v6 wird automatisch aus `tbp_v5` migriert — die v5-Daten bleiben dabei unverändert als Fallback.

## Entwicklungsstand

**v6 Phase 1** (aktuell):
- Edit/View-Toggle
- Emoji-Pins (3 Darstellungsarten)
- Asset-Info + Edit-Dialog mit customName und Trassen-Verknüpfung
- Migration aus v5

**v6 Phase 2** (in Arbeit):
- Vollständiger Kabel-Editor mit Custom-Typen
- Reserve in % oder Metern
- Pfeil-Rendering Asset↔Trasse
- Erweiterte Exporte (PDF je Trasse, Excel-Sheets)

Bis Phase 2 fertig ist, sind Kalkulation und Export auskommentiert. Für produktive Nutzung bleibt v5 der Fallback.
