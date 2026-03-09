---
name: fireauto-ui-guide
description: >
  "DaisyUI", "daisyui", "UI 마이그레이션", "UI migration",
  "shadcn to daisyui", "테마 설정", "theme", "컴포넌트 변환",
  "DaisyUI 테마", "DaisyUI 컴포넌트" 등 DaisyUI 기반 UI 구축이나
  shadcn/ui 마이그레이션 시 사용하세요.
---

# DaisyUI v5 Best Practices

## 핵심 원칙

1. **시맨틱 컬러 우선**: 하드코딩 색상 대신 DaisyUI 시맨틱 토큰 사용
2. **클래스 기반**: React 컴포넌트 import 없이 HTML 클래스로 UI 구성
3. **테마 일관성**: oklch() 컬러 시스템으로 테마 간 일관된 색상 유지
4. **최소 JS**: CSS-only 솔루션 활용 (modal, collapse, swap)

## shadcn → DaisyUI 빠른 변환

```
Button variant="default"     → btn btn-primary
Button variant="ghost"       → btn btn-ghost
Button variant="outline"     → btn btn-outline
Button variant="destructive" → btn btn-error
Card                         → card bg-base-100 shadow-xl
Badge                        → badge
Input                        → input input-bordered w-full
Dialog                       → modal (HTML dialog)
Tabs                         → tabs tabs-bordered
Switch                       → toggle
Separator                    → divider
Skeleton                     → skeleton
Sheet                        → drawer
```

## 색상 전환

```
bg-black        → bg-base-100 (다크 테마에서)
text-white      → text-base-content
text-zinc-400   → text-base-content/60
bg-zinc-800     → bg-base-200
border-zinc-700 → border-base-300
```

## 컴포넌트 카탈로그 요약

| 카테고리 | 컴포넌트 |
|----------|----------|
| Layout | navbar, drawer, footer, hero |
| Navigation | menu, tabs, breadcrumbs, pagination |
| Data Display | card, table, stat, countdown, timeline |
| Input | button, input, select, textarea, checkbox, toggle, range |
| Feedback | alert, toast, loading, progress, skeleton, tooltip |
| Overlay | modal, dropdown, swap, collapse |

## 테마 설정 (globals.css)

```css
@plugin "daisyui" {
  themes: light --default, dark --prefersdark,
  my_theme {
    primary: oklch(0.7 0.2 75);
    secondary: oklch(0.6 0.15 250);
    accent: oklch(0.75 0.18 150);
    neutral: oklch(0.3 0.01 260);
    base-100: oklch(0.98 0.005 260);
    base-200: oklch(0.93 0.005 260);
    base-300: oklch(0.88 0.005 260);
    base-content: oklch(0.2 0.01 260);
  };
}
```

## 커맨드

- `/fireauto-ui` — 3가지 모드 (build, migrate, theme)

## 추가 리소스

- 컴포넌트 패턴 상세: `references/components.md`
- 마이그레이션 치트시트: `references/migration-cheatsheet.md`
- oklch 색상 참조: `references/oklch-colors.md`
