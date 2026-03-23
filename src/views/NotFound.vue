<template>
  <v-app>
    <v-main>
      <div class="not-found">
        <div class="content">
          <!-- Vinyl + needle -->
          <div class="vinyl-scene">
            <div class="vinyl">
              <div
                v-for="i in 6"
                :key="i"
                class="groove"
                :style="`--i: ${i}`"
              ></div>
              <div class="label">
                <div class="label-text">MA</div>
                <div class="label-hole"></div>
              </div>
            </div>
            <div class="needle-arm">
              <div class="needle-rod"></div>
              <div class="needle-head"></div>
            </div>
          </div>

          <!-- 404 -->
          <h1 class="error-code">
            <span>4</span><span class="zero">0</span><span>4</span>
          </h1>

          <p class="headline">{{ $t("not_found_headline") }}</p>
          <p class="subtext">{{ $t("not_found_subtext") }}</p>

          <!-- Equalizer -->
          <div class="equalizer" aria-hidden="true">
            <div
              v-for="i in 12"
              :key="i"
              class="eq-bar"
              :style="`--i: ${i}`"
            ></div>
          </div>

          <!-- Buttons -->
          <div class="actions">
            <Button variant="default" @click="router.back()">
              <ArrowLeft class="size-4" />
              {{ $t("back") }}
            </Button>
            <Button variant="outline" @click="router.push('/discover')">
              <Compass class="size-4" />
              {{ $t("discover") }}
            </Button>
          </div>
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { ArrowLeft, Compass } from "lucide-vue-next";
import { useRouter } from "vue-router";

defineOptions({ name: "NotFound" });

const router = useRouter();
</script>

<style scoped>
/* ─── Layout ─── */
.not-found {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  overflow: hidden;
  padding: 32px 24px;
}

.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
  max-width: 420px;
}

/* ─── Vinyl scene ─── */
.vinyl-scene {
  position: relative;
  width: 180px;
  height: 180px;
}

.vinyl {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, transparent 22px, #111 23px),
    repeating-conic-gradient(#1c1c1c 0deg, #2a2a2a 1deg, #1c1c1c 2deg);
  box-shadow:
    0 0 0 1px #333,
    0 12px 40px rgba(0, 0, 0, 0.6),
    inset 0 0 20px rgba(255, 255, 255, 0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: vinyl-spin 3s linear infinite;
  position: relative;
}

.groove {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.04);
  --size: calc(40px + var(--i) * 20px);
  width: var(--size);
  height: var(--size);
}

.label {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 35%,
    hsl(var(--primary) / 0.9),
    hsl(var(--primary) / 0.6)
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
  position: relative;
  z-index: 1;
}

.label-text {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #ffffff;
  line-height: 1;
}

.label-hole {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: hsl(var(--background));
}

/* Needle arm */
.needle-arm {
  position: absolute;
  top: -8px;
  right: -24px;
  transform-origin: top right;
  animation: needle-sway 3s ease-in-out infinite;
}

.needle-rod {
  width: 3px;
  height: 80px;
  background: linear-gradient(
    to bottom,
    hsl(var(--muted-foreground) / 0.6),
    hsl(var(--muted-foreground) / 0.3)
  );
  border-radius: 2px;
  transform: rotate(28deg);
  transform-origin: top center;
}

.needle-head {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%) rotate(28deg);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: hsl(var(--primary));
  box-shadow: 0 0 6px hsl(var(--primary));
}

@keyframes vinyl-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes needle-sway {
  0%,
  100% {
    transform: rotate(-2deg);
  }
  50% {
    transform: rotate(2deg);
  }
}

/* ─── 404 ─── */
.error-code {
  font-size: 6rem;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.04em;
  margin: 0;
  display: flex;
  gap: 2px;
}

.error-code span {
  color: hsl(var(--primary));
  animation: digit-pulse 2s ease-in-out infinite;
}

.error-code .zero {
  animation-delay: 0.3s;
}

.error-code span:last-child {
  animation-delay: 0.6s;
}

@keyframes digit-pulse {
  0%,
  100% {
    opacity: 1;
    transform: translateY(0);
  }
  50% {
    opacity: 0.6;
    transform: translateY(-4px);
  }
}

/* ─── Text ─── */
.headline {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
}

.subtext {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  margin: 0;
}

/* ─── Equalizer ─── */
.equalizer {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 32px;
}

.eq-bar {
  width: 6px;
  border-radius: 3px 3px 0 0;
  background: hsl(var(--primary) / 0.7);
  animation: eq-bounce calc(0.5s + var(--i) * 0.07s) ease-in-out infinite
    alternate;
  animation-delay: calc(var(--i) * 0.06s);
}

@keyframes eq-bounce {
  from {
    height: 4px;
    opacity: 0.4;
  }
  to {
    height: 28px;
    opacity: 1;
  }
}

/* ─── Buttons ─── */
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
