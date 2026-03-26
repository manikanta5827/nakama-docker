export const styles: Record<string, React.CSSProperties> = {
  root: {
    display:         "flex",
    flexDirection:   "row",
    minHeight:       "100vh",
    background:      "#0d0d0f",
    color:           "#e5e7eb",
    fontFamily:      "'Courier New', monospace",
    gap:             0,
  },

  // ── Game Panel ──
  gamePanel: {
    flex:            1,
    display:         "flex",
    flexDirection:   "column",
    alignItems:      "center",
    justifyContent:  "center",
    padding:         "40px 32px",
    borderRight:     "1px solid rgba(255,255,255,0.08)",
  },

  header: {
    display:         "flex",
    alignItems:      "center",
    gap:             20,
    marginBottom:    32,
  },

  logo: {
    fontSize:        40,
    fontWeight:      900,
    letterSpacing:   4,
    color:           "#a78bfa",
  },

  playerName: {
    fontSize:        16,
    fontWeight:      700,
    color:           "#e5e7eb",
    marginBottom:    4,
  },

  statusBadge: {
    fontSize:        12,
    color:           "#6b7280",
    letterSpacing:   1,
    textTransform:   "uppercase",
  },

  matchIdBox: {
    display:         "flex",
    flexDirection:   "column",
    alignItems:      "center",
    gap:             4,
    marginBottom:    20,
    padding:         "10px 16px",
    background:      "rgba(255,255,255,0.04)",
    borderRadius:    8,
    border:          "1px solid rgba(255,255,255,0.08)",
    maxWidth:        320,
    wordBreak:       "break-all",
  },

  matchIdLabel: {
    fontSize:        10,
    letterSpacing:   2,
    color:           "#6b7280",
  },

  matchIdValue: {
    fontSize:        11,
    color:           "#a78bfa",
    fontFamily:      "monospace",
  },

  symbolBox: {
    fontSize:        16,
    marginBottom:    24,
    color:           "#9ca3af",
  },

  lobbyButtons: {
    display:         "flex",
    gap:             12,
    marginTop:       8,
  },

  btnPrimary: {
    padding:         "12px 28px",
    background:      "#a78bfa",
    color:           "#0d0d0f",
    border:          "none",
    borderRadius:    8,
    fontWeight:      700,
    fontSize:        14,
    cursor:          "pointer",
    letterSpacing:   1,
  },

  btnSecondary: {
    padding:         "12px 28px",
    background:      "transparent",
    color:           "#a78bfa",
    border:          "1px solid #a78bfa",
    borderRadius:    8,
    fontWeight:      700,
    fontSize:        14,
    cursor:          "pointer",
    letterSpacing:   1,
  },

  btnGhost: {
    marginTop:       24,
    padding:         "8px 20px",
    background:      "transparent",
    color:           "#6b7280",
    border:          "1px solid rgba(255,255,255,0.1)",
    borderRadius:    6,
    cursor:          "pointer",
    fontSize:        13,
  },

  board: {
    display:         "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap:             6,
    padding:         8,
    background:      "rgba(255,255,255,0.03)",
    borderRadius:    12,
    border:          "1px solid rgba(255,255,255,0.08)",
  },

  cell: {
    width:           88,
    height:          88,
    border:          "1px solid rgba(255,255,255,0.08)",
    borderRadius:    8,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    transition:      "background 0.15s",
  },

  turnStatus: {
    marginTop:       24,
    fontSize:        18,
    fontWeight:      700,
    minHeight:       28,
  },

  // ── Stats Panel ──
  statsPanel: {
    width:           300,
    display:         "flex",
    flexDirection:   "column",
    padding:         "32px 20px",
    background:      "rgba(255,255,255,0.02)",
  },

  statsHeader: {
    display:         "flex",
    justifyContent:  "space-between",
    alignItems:      "center",
    fontSize:        16,
    fontWeight:      700,
    marginBottom:    20,
    color:           "#e5e7eb",
  },

  refreshBtn: {
    background:      "transparent",
    border:          "1px solid rgba(255,255,255,0.15)",
    color:           "#9ca3af",
    borderRadius:    6,
    padding:         "2px 10px",
    cursor:          "pointer",
    fontSize:        16,
  },

  summaryRow: {
    display:         "flex",
    gap:             8,
    marginBottom:    28,
  },

  summaryCard: {
    flex:            1,
    padding:         "12px 8px",
    background:      "rgba(255,255,255,0.04)",
    borderRadius:    8,
    border:          "1px solid",
    textAlign:       "center",
  },

  summaryNum: {
    fontSize:        28,
    fontWeight:      900,
    lineHeight:      1,
  },

  summaryLabel: {
    fontSize:        11,
    color:           "#6b7280",
    marginTop:       4,
    letterSpacing:   1,
    textTransform:   "uppercase",
  },

  historyLabel: {
    fontSize:        11,
    letterSpacing:   2,
    color:           "#6b7280",
    textTransform:   "uppercase",
    marginBottom:    12,
  },

  historyList: {
    display:         "flex",
    flexDirection:   "column",
    gap:             8,
    overflowY:       "auto",
    maxHeight:       "38vh",
    minHeight:       "180px",
    paddingRight:    4,
    borderRadius:    8,
    boxShadow:       "inset 0 0 0 1px rgba(255,255,255,0.08)",
  },

  emptyHistory: {
    color:           "#4b5563",
    fontSize:        13,
    textAlign:       "center",
    marginTop:       32,
  },

  historyRow: {
    display:         "flex",
    justifyContent:  "space-between",
    alignItems:      "center",
    padding:         "10px 12px",
    background:      "rgba(255,255,255,0.03)",
    borderRadius:    6,
    paddingLeft:     10,
  },

  historyLeft: {
    display:         "flex",
    alignItems:      "center",
    gap:             10,
  },

  historyIcon: {
    fontSize:        18,
  },

  historyResult: {
    fontSize:        13,
    fontWeight:      700,
    letterSpacing:   0.5,
  },

  historyReason: {
    fontSize:        11,
    fontWeight:      400,
    color:           "#6b7280",
  },

  historyOpponent: {
    fontSize:        11,
    color:           "#4b5563",
    marginTop:       2,
  },

  historyTime: {
    fontSize:        11,
    color:           "#4b5563",
    whiteSpace:      "nowrap",
  },
};