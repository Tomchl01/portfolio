# Design Philosophy: Power in Subtlety

## The Transformation

Your portfolio has been refined with these guiding principles:

### 1. Power in Subtlety
*"True authority never shouts"*

**What changed:**
- Removed casual greeting "Hi, I'm Tom" → Clean presentation "Tom Chévez"
- Lighter font weights (300-400) for sophistication
- Muted color palette with strategic accent usage
- Glass morphism reduced from 0.7 to 0.65 opacity for more subtlety

**Philosophy:**
A quiet design says: "I see you already."
Restraint is power.

---

### 2. Hierarchy Without Rigidity
*"Weight and lightness, not dominance"*

**Implementation:**
- **Titles**: Large but softened with generous spacing
  - Hero: 5rem (clamp 2.5-5rem) at weight 300
  - Section headers: 3rem (clamp 2-3rem) at weight 300
  
- **Sections**: Rhythm of contrast
  - Emphasized paragraphs (1.3rem, weight 400) 
  - Body text (1.1rem, weight 300)
  - Breathing room between blocks (48-96px spacing)

- **Color**: Hierarchy from tone
  - Primary: #1d1d1f (almost black)
  - Secondary: #6e6e73 (neutral gray)
  - Tertiary: #86868b (lighter gray)
  - Accent: #0071e3 (used sparingly)

---

### 3. Architecture of Presence
*"Each page should have its own atmosphere"*

**Structure:**

#### The Threshold (Homepage)
- Hero section: 70vh minimum height - invites stillness
- Centered, spacious layout
- Sequential reveal animations (1200ms breath timing)
- 192px spacing before content begins

#### The Workshop (Projects)
- Organized card grid
- Clear status indicators (Coming soon, In progress)
- Generous padding and margins
- Each project card = its own moment

#### The Study (Contact)
- Personal, quieter atmosphere
- Icon-led sections
- Descriptive context under each method
- Maintains glass aesthetic but more intimate

**The invisible parts:**
- Padding: 24-96px scale
- Margins: 48-192px rhythm
- Alignment: max-width 1080px (down from 1200px)
- Line height: 1.7-1.8 (up from 1.6)

---

### 4. Motion as Breath
*"Motion should mimic breathing, not performance"*

**Implementation:**

**Inhale** (Page arrival):
```
Animation: 1200ms cubic-bezier(0.4, 0, 0.2, 1)
Elements fade in with 20px upward motion
Sequential delays: 0ms, 200ms, 400ms, 600ms
```

**Exhale** (Interactions):
```
Transition: 600-800ms cubic-bezier(0.4, 0, 0.6, 1)
Hovers: subtle 2px lift
Nav on scroll: opacity fades to 0.3 (not disappears)
Cards: gentle transform, no aggressive parallax
```

**Scroll behavior:**
- Smooth, native scroll
- Intersection observer with 80px bottom margin
- Elements reveal at 15% visibility
- No jarring movements

**Philosophy:**
The page inhales as you arrive; it exhales as you leave.
Users feel guided, not manipulated.

---

### 5. Symbol and Signature
*"A recurring element that reflects essence"*

**Your signature elements:**

1. **The Diamond (◆)**: Appears in console log - a quiet mark
2. **Glass morphism**: Consistent across all interactive elements
3. **Breathing rhythm**: All animations follow same timing curve
4. **Generous whitespace**: Your signature gesture of respect
5. **Monochromatic palette + single accent**: Shows restraint and intention

---

## Technical Specifications

### Spacing Scale
```css
--space-xs: 12px
--space-sm: 24px
--space-md: 48px
--space-lg: 96px
--space-xl: 144px
--space-xxl: 192px
```

### Typography Scale
```css
Hero h1: clamp(2.5rem, 6vw, 5rem) weight 300
Hero subtitle: 0.9rem weight 400 uppercase
Hero description: clamp(1.1rem, 2vw, 1.3rem) weight 300

Section h1: clamp(2rem, 4vw, 3rem) weight 300
Section h2: clamp(1.5rem, 3vw, 2rem) weight 400

Emphasis text: 1.3rem weight 400
Body: 1.1rem weight 300
Meta text: 0.9rem weight 300
```

### Timing Functions
```css
--transition-breath: 800ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-exhale: 600ms cubic-bezier(0.4, 0, 0.6, 1)
```

### Shadow Hierarchy
```css
--shadow-sm: 0 2px 16px rgba(0,0,0,0.06)  // Subtle elevation
--shadow-md: 0 8px 32px rgba(0,0,0,0.08)  // Card hover
--shadow-lg: 0 20px 60px rgba(0,0,0,0.10) // Dramatic depth
```

---

## What This Communicates

**Before:**
"Look at my portfolio! See all these features!"

**After:**
"I understand what matters. Let me show you my work with respect for your time and attention."

The design now embodies:
- **Maturity**: Through restraint and hierarchy
- **Confidence**: Through whitespace and simplicity  
- **Craftsmanship**: Through invisible details (padding, timing, alignment)
- **Humanity**: Through breathing motion and gentle reveals

---

## Mobile Responsiveness

Maintains rhythm on smaller screens:
- Spacing scales down proportionally
- Typography uses clamp() for fluid sizing
- Navigation becomes centered when space is limited
- Hero height adjusts to 60vh
- All breathing animations preserved

---

## Accessibility

- Smooth scroll with `scroll-behavior: smooth`
- Respects `prefers-reduced-motion`
- Focus states: 2px outline, 4px offset
- Semantic HTML structure
- Color contrast ratios maintained
- Alt text and ARIA where needed

---

## The Result

A portfolio that whispers expertise instead of shouting competence.

When someone visits, they feel:
"This person knows what they're doing. They respect my attention. I want to learn more."

That's the power of subtlety.

---

© 2025 Tom Chévez — Refined with intention
