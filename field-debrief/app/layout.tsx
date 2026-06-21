@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  /* Brand palette — The/Nudge Foundation */
  --nudge-cream:      #F5F0E8;
  --nudge-cream-dark: #EDE7D9;
  --nudge-terracotta: #B5521B;
  --nudge-terra-light:#FAE8DF;
  --nudge-teal:       #2D4A3E;
  --nudge-teal-light: #E2EDE9;
  --nudge-ink:        #1E2A22;
  --nudge-muted:      #6B7C74;

  --background: #F5F0E8;
  --foreground: #1E2A22;
  --card: #FDFAF5;
  --card-foreground: #1E2A22;
  --popover: #FDFAF5;
  --popover-foreground: #1E2A22;
  --primary: #B5521B;
  --primary-foreground: #FDFAF5;
  --secondary: #EDE7D9;
  --secondary-foreground: #1E2A22;
  --muted: #EDE7D9;
  --muted-foreground: #6B7C74;
  --accent: #2D4A3E;
  --accent-foreground: #FDFAF5;
  --destructive: #C0392B;
  --border: #DDD6C8;
  --input: #DDD6C8;
  --ring: #B5521B;
  --radius: 0.75rem;
  --sidebar: #FDFAF5;
  --sidebar-foreground: #1E2A22;
  --sidebar-primary: #B5521B;
  --sidebar-primary-foreground: #FDFAF5;
  --sidebar-accent: #EDE7D9;
  --sidebar-accent-foreground: #1E2A22;
  --sidebar-border: #DDD6C8;
  --sidebar-ring: #B5521B;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}

/* Nudge brand utility classes */
.btn-primary {
  background-color: var(--nudge-terracotta);
  color: #FDFAF5;
  border-radius: var(--radius);
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.15s ease;
}
.btn-primary:hover { background-color: #9A4416; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-teal {
  background-color: var(--nudge-teal);
  color: #FDFAF5;
  border-radius: var(--radius);
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.15s ease;
}
.btn-teal:hover { background-color: #223B31; }

.card-nudge {
  background: var(--card);
  border: 1px solid var(--nudge-cream-dark);
  border-radius: var(--radius-xl);
}

.input-nudge {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  background: #FDFAF5;
  color: var(--nudge-ink);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input-nudge:focus {
  outline: none;
  border-color: var(--nudge-terracotta);
  box-shadow: 0 0 0 3px rgba(181, 82, 27, 0.12);
}

.badge-routine    { background: #E2EDE9; color: #2D4A3E; }
.badge-attention  { background: #FEF3C7; color: #92400E; }
.badge-escalate   { background: #FEE2E2; color: #991B1B; }
.badge-positive   { background: #DCFCE7; color: #166534; }
.badge-mixed      { background: #FEF9C3; color: #713F12; }
.badge-negative   { background: #FEE2E2; color: #991B1B; }
.badge-officer    { background: #EDE7D9; color: #4A3728; }
.badge-manager    { background: #E2EDE9; color: #2D4A3E; }
.badge-admin      { background: #FAE8DF; color: #B5521B; }