git pu# FeynMap

**An AI coach that makes you explain concepts, detects gaps in understanding, and shows your knowledge as an unlockable map.**

---

## Key Features

- **Infinite canvas** - n8n-style node-based interface for learning
- **Gamification** - XP, unlocks, levels, visual progress
- **Addictive UI** - Learning feels like playing a game
- **Knowledge connections** - See how concepts relate
- **Gap visualization** - Know what you don't know

---

## Build Features (In Order)

### Feature 1: Text Input → LLM
Simple text input connected to Gemini. User types, AI responds.

### Feature 2: Topic → Map Generation
User picks topic → AI generates concept tree with interconnected nodes on infinite canvas (ReactFlow).

### Feature 3: Node Interaction & Scoring
Click node → AI explains (teacher mode) → User explains back in simple words → AI scores using Feynman Technique → Node unlocks based on score.

### Feature 4: Visual Unlocking
Node color changes based on understanding (locked 🔒 → learning 🌕 → mastered ⭐). Connected nodes unlock when prerequisites met.

### Feature 5: Full Loop Polish
Smooth animations, progress tracking, XP system, seamless flow from topic selection → mastery.

### Feature X: Voice Layer (Optional)
Voice-first interaction using Hume EVI. Evaluate emotional understanding through voice tone and confidence.

---

## Tech Stack

**Frontend:**
- 

**Backend:**
- 

**AI:**
- 

**Deploy:**
- 

---

## Demo Requirements

**Must work in 60 seconds:**
1. User types "Personal Finance"
2. Map appears with concept nodes
3. User clicks "Budgeting"
4. AI explains, asks user to explain back
5. Node unlocks (color change + animation)

**Judge experience:** "I see my understanding unlock in real-time"

---

## Success Criteria

- ReactFlow renders 10+ nodes smoothly
- Gemini responds in <2 seconds
- Node state changes are instant
- Judge experiences "unlock" moment
- No crashes during demo

---

## Core Principle

**Active learning beats passive.** You only truly understand when you can explain it simply.
