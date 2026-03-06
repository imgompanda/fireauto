# DaisyUI v5 컴포넌트 패턴 상세

## 버튼

```html
<!-- 기본 -->
<button class="btn btn-primary">기본</button>
<button class="btn btn-secondary">보조</button>
<button class="btn btn-accent">강조</button>

<!-- 크기 -->
<button class="btn btn-xs">XS</button>
<button class="btn btn-sm">SM</button>
<button class="btn btn-lg">LG</button>

<!-- 스타일 -->
<button class="btn btn-outline btn-primary">아웃라인</button>
<button class="btn btn-ghost">고스트</button>
<button class="btn btn-link">링크</button>
<button class="btn btn-soft btn-primary">소프트</button>

<!-- 로딩 -->
<button class="btn btn-primary">
  <span class="loading loading-spinner loading-sm"></span>로딩
</button>
```

## 카드

```html
<div class="card bg-base-100 shadow-xl">
  <figure><img src="..." alt="..." /></figure>
  <div class="card-body">
    <h2 class="card-title">제목</h2>
    <p>설명</p>
    <div class="card-actions justify-end">
      <button class="btn btn-primary">액션</button>
    </div>
  </div>
</div>
```

## 모달

```html
<button class="btn" onclick="my_modal.showModal()">열기</button>
<dialog id="my_modal" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">제목</h3>
    <p class="py-4">내용</p>
    <div class="modal-action">
      <form method="dialog"><button class="btn">닫기</button></form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
```

## 네비바

```html
<div class="navbar bg-base-100">
  <div class="navbar-start"><a class="btn btn-ghost text-xl">로고</a></div>
  <div class="navbar-center hidden lg:flex">
    <ul class="menu menu-horizontal px-1">
      <li><a>항목 1</a></li>
    </ul>
  </div>
  <div class="navbar-end"><a class="btn btn-primary">CTA</a></div>
</div>
```

## 드로어

```html
<div class="drawer lg:drawer-open">
  <input id="my-drawer" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content">
    <label for="my-drawer" class="btn btn-ghost drawer-button lg:hidden">메뉴</label>
  </div>
  <div class="drawer-side">
    <label for="my-drawer" class="drawer-overlay"></label>
    <ul class="menu bg-base-200 min-h-full w-80 p-4">
      <li><a>항목</a></li>
    </ul>
  </div>
</div>
```

## 히어로

```html
<div class="hero min-h-screen bg-base-200">
  <div class="hero-content text-center">
    <div class="max-w-md">
      <h1 class="text-5xl font-bold">제목</h1>
      <p class="py-6">설명</p>
      <button class="btn btn-primary">시작하기</button>
    </div>
  </div>
</div>
```

## Stats

```html
<div class="stats shadow">
  <div class="stat">
    <div class="stat-title">총 방문</div>
    <div class="stat-value text-primary">25.6K</div>
    <div class="stat-desc">21% 증가</div>
  </div>
</div>
```

## 가격 카드

```html
<div class="card bg-base-100 shadow-xl border border-primary">
  <div class="card-body items-center text-center">
    <span class="badge badge-primary">인기</span>
    <h2 class="card-title text-2xl">프로 플랜</h2>
    <p class="text-4xl font-bold text-primary">$29<span class="text-sm text-base-content/60">/월</span></p>
    <div class="card-actions">
      <button class="btn btn-primary btn-wide">시작하기</button>
    </div>
  </div>
</div>
```

## FAQ 아코디언

```html
<div class="join join-vertical w-full">
  <div class="collapse collapse-arrow join-item border border-base-300">
    <input type="radio" name="faq" checked />
    <div class="collapse-title text-xl font-medium">질문 1</div>
    <div class="collapse-content"><p>답변 1</p></div>
  </div>
</div>
```
