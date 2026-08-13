# @zerosky/ui

Shared design system package for Zerosky POS with semantic tokens and full light/dark theme support.

## Token System

The design system is built on semantic HSL tokens that automatically adapt between light and dark themes. All tokens are defined in `src/styles/theme.css` and wired into Tailwind CSS v4 via `@theme inline`.

### Core Semantic Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `0 0% 100%` (white) | `222.2 84% 4.9%` (dark blue-gray) | Page background |
| `--foreground` | `222.2 84% 4.9%` (near-black) | `210 40% 98%` (near-white) | Primary text |
| `--card` | `0 0% 100%` (white) | `222.2 47% 11.2%` (elevated dark) | Card surfaces |
| `--card-foreground` | `222.2 84% 4.9%` | `210 40% 98%` | Text on cards |
| `--primary` | `221.2 83.2% 53.3%` (blue) | `217.2 91.2% 59.8%` (lighter blue) | Primary actions |
| `--primary-foreground` | `210 40% 98%` | `222.2 47% 11.2%` | Text on primary |
| `--muted` | `210 40% 96%` (light gray) | `217.2 32.6% 17.5%` (dark gray) | Muted surfaces |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `215 20.2% 65.1%` | Secondary text |
| `--border` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | Borders |
| `--input` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | Input borders |
| `--ring` | `221.2 83.2% 53.3%` | `224.3 76.3% 48%` | Focus rings |
| `--destructive` | `0 84.2% 60.2%` (red) | `0 62.8% 30.6%` (dark red) | Destructive actions |

### Color Scales

Numbered scales (`50-950`) for `primary`, `accent`, and `gray` are available for gradual color progression.

## Components

### Button
```tsx
import { Button } from '@zerosky/ui';

<Button variant="default" size="default">Click me</Button>
```
**Variants**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`  
**Sizes**: `default`, `sm`, `lg`, `icon`

### Card
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@zerosky/ui';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>
```

### Badge
```tsx
import { Badge } from '@zerosky/ui';

<Badge variant="available">Available</Badge>
```
**POS-specific variants**: `available`, `occupied`, `reserved`, `billed`, `cleaning`, `open`, `sent_to_kitchen`, `ready`, `served`, `billed_order`, `paid`, `cancelled`

### Input
```tsx
import { Input } from '@zerosky/ui';

<Input type="text" placeholder="Enter text" />
```

### Select
```tsx
import { Select } from '@zerosky/ui';

<Select>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</Select>
```

### Textarea
```tsx
import { Textarea } from '@zerosky/ui';

<Textarea placeholder="Enter text" />
```

### Dialog
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@zerosky/ui';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    Content here
  </DialogContent>
</Dialog>
```

### Table
```tsx
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@zerosky/ui';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Spinner
```tsx
import { Spinner } from '@zerosky/ui';

<Spinner message="Loading..." />
```

## Installation

This package is internal to the monorepo. Add to your app's `package.json`:

```json
{
  "dependencies": {
    "@zerosky/ui": "*"
  }
}
```

Then import the theme stylesheet in your app's root CSS:

```css
@import "@zerosky/ui/styles.css";
```

## Accessibility

All components meet WCAG AA contrast requirements (4.5:1 for body text, 3:1 for large text) in both light and dark themes. Interactive elements include visible focus indicators via the `--ring` token.
