# AMPlifier
## Academic Management Platform
*Your academics, amplified.*

AMPlifier is a desktop-first academic management, analytics, and intelligence platform. It provides deterministic grade tracking, dynamic report card estimations, what-if grade simulations, multi-scenario forecasting, and external AI interoperability via the Model Context Protocol (MCP).

---

## 🌟 Key Capabilities

1. **Academic Command Center**: Real-time overview of current General Average, active grading period, honors standing, and weakness detection.
2. **Deterministic Grading Engine**:
   - Zero AI drift: 100% mathematical, testable calculations.
   - DepEd Order No. 8, s. 2015 official transmutation table & custom raw weighted percentage models.
   - Configurable component weights (Written Works, Performance Tasks, Quarterly Examination).
   - Dynamic weight normalization for incomplete grading periods.
3. **Estimated Report Card & Projections**: Continuously recalculating report card with editable future grade assumptions.
4. **Grade Simulator**:
   - **What-If Sandbox**: Test hypothetical scores (e.g. 19/20 on Science Quiz) to observe immediate impact on subject grade and General Average.
   - **Target Score Solver**: Calculate the exact required score on an upcoming exam or performance task to attain a target grade (e.g. 95).
5. **Advanced Grade Forecaster**:
   - Conservative, Realistic, and Optimistic forecasting scenarios.
   - General Average Goal Planner: Computes required average on all remaining quarters to reach honors targets.
6. **Academic Tasks Tracker**: Monitor upcoming quizzes, exams, performance tasks, projects, and deadlines.
7. **Storage & Google Drive Sync**: Local-first schema with automated `.ampbackup.json` export and restore.
8. **Model Context Protocol (MCP) Server**: Exposes structured `READ`, `SIMULATE`, and `WRITE` tools for Claude and other MCP-compatible AI systems.

---

## 🚀 Getting Started

### Development Server
```bash
npm install
npm run dev
```

### Run Automated Unit Test Suite
```bash
npm test
```

### Build for Production
```bash
npm run build
```

### Run AMPlifier MCP Server
```bash
npm run mcp
```

### Adding AMPlifier to Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "amplifier": {
      "command": "node",
      "args": [
        "--loader",
        "tsx",
        "C:/dev/amplifier/src/mcp/server.ts"
      ]
    }
  }
}
```

---

## 📐 Architecture

- **Frontend & Shell**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **Engine Core**: Pure TypeScript stateless modules in `src/engine/` with comprehensive Vitest coverage.
- **MCP Server**: `@modelcontextprotocol/sdk` in `src/mcp/server.ts`.
- **Storage Layer**: Local-first JSON adapter with backup & import utilities in `src/storage/`.
