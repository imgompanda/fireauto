# shadcn/ui → DaisyUI 마이그레이션 치트시트

## import 제거 대상

```typescript
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
```

## 빠른 변환 참조

```
Button variant="default"     → btn btn-primary
Button variant="ghost"       → btn btn-ghost
Button variant="outline"     → btn btn-outline
Button variant="secondary"   → btn btn-secondary
Button variant="destructive" → btn btn-error
Button variant="link"        → btn btn-link
Button size="sm"             → btn btn-sm
Button size="lg"             → btn btn-lg
Button size="icon"           → btn btn-square btn-sm

Card                         → card bg-base-100 shadow-xl
CardTitle                    → card-title
CardContent                  → card-body
CardFooter                   → card-actions

Badge                        → badge
Badge variant="secondary"    → badge badge-secondary
Badge variant="destructive"  → badge badge-error
Badge variant="outline"      → badge badge-outline

Input                        → input input-bordered w-full
Textarea                     → textarea textarea-bordered w-full
Select                       → select select-bordered w-full
Checkbox                     → checkbox
Switch                       → toggle

Dialog                       → modal (HTML dialog)
Alert                        → alert
Avatar                       → avatar
Tooltip                      → tooltip (data-tip 속성)
Separator                    → divider
Skeleton                     → skeleton
Progress                     → progress
Sheet                        → drawer
```
