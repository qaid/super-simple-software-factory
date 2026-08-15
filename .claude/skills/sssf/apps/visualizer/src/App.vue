<script setup lang="ts">
import { useRoute, hrefFor, phaseCrumb } from './lib/router'
import SessionTrace from './components/SessionTrace.vue'
import SessionsCommand from './components/SessionsCommand.vue'
import ThemeToggle from './components/ThemeToggle.vue'

const route = useRoute()
</script>

<template>
  <div class="app">
    <header class="topbar">
      <nav class="crumbs">
        <!-- Inline copy of public/logo.svg (the favicon) so the mark renders
             crisply with no fetch; keep the two in sync. -->
        <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="4" y="6" width="17" height="5" rx="2.5" fill="currentColor" opacity="0.55" />
          <rect x="8" y="13.5" width="20" height="5" rx="2.5" fill="currentColor" />
          <rect x="4" y="21" width="13" height="5" rx="2.5" fill="currentColor" opacity="0.75" />
        </svg>
        <span class="brand">Super Simple Software Factory</span>
        <span class="sep">›</span>
        <a :href="hrefFor()" :class="{ current: !route.adwId }">sessions</a>
        <template v-if="route.adwId">
          <span class="sep">›</span>
          <a :href="hrefFor(route.adwId)" :class="{ current: !route.phaseId }">{{
            route.adwId
          }}</a>
        </template>
        <template v-if="route.adwId && route.phaseId">
          <span class="sep">›</span>
          <span class="current">{{ phaseCrumb ?? route.phaseId }}</span>
        </template>
      </nav>
      <div class="chrome">
        <span class="live-hint"><span class="live-dot" /> live</span>
        <ThemeToggle />
      </div>
    </header>
    <main>
      <SessionsCommand v-if="!route.adwId" />
      <SessionTrace v-else :key="route.adwId" :adw-id="route.adwId" :phase-id="route.phaseId" />
    </main>
  </div>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 24px;
  background: var(--panel);
  border-bottom: 1px solid var(--border-soft);
  position: sticky;
  top: 0;
  z-index: 10;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  min-width: 0;
}

.chrome {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
}

.logo {
  width: 26px;
  height: 26px;
  flex: none;
  color: var(--primary);
}

.brand {
  color: var(--text);
  font-weight: 700;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.sep {
  color: var(--faint);
}

.crumbs a {
  color: var(--dim);
}

.crumbs a:hover {
  color: var(--text);
}

.crumbs .current {
  color: var(--text);
  font-weight: 500;
}

.live-hint {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--faint);
  font-size: 13px;
  white-space: nowrap;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 1.6s ease-in-out infinite;
}
</style>
