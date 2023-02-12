<template>
  <component
    :is="iconComponent"
    role="img"
    class="inline-block fill-current"
    :style="`height: ${height}; width: ${width}`"
  />
</template>

<script lang="ts">
import Aac from './Aac.vue';
import Crossfade from './Crossfade.vue';
import DefaultArtist from './DefaultArtist.vue';
import Fallback from './Fallback.vue';
import Filesystem from './Filesystem.vue';
import Flac from './Flac.vue';
import HiResAudio from './HiResAudio.vue';
import Level from './Level.vue';
import M4a from './M4a.vue';
import Mp3 from './Mp3.vue';
import Ogg from './Ogg.vue';
import Qobuz from './Qobuz.vue';
import Spotify from './Spotify.vue';
import Tunein from './Tunein.vue';
import YTMusic from './YTMusic.vue';

const icons: any = {
  aac: Aac,
  crossfade: Crossfade,
  defaultArtist: DefaultArtist,
  fallback: Fallback,
  filesystem: Filesystem,
  flac: Flac,
  hiResAudio: HiResAudio,
  level: Level,
  m4a: M4a,
  mp3: Mp3,
  ogg: Ogg,
  qobuz: Qobuz,
  spotify: Spotify,
  tunein: Tunein,
  ytmusic: YTMusic,
};

export default {
  props: {
    // eslint-disable-next-line vue/require-default-prop
    darkMode: {
      type: Boolean,
      required: false,
      default: true,
    },
    height: {
      type: String,
      required: false,
      default: '1.4em',
    },
    width: {
      type: String,
      required: false,
      default: '1.4em',
    },
    name: {
      type: String,
      required: true,
      validator(value: any) {
        return Object.prototype.hasOwnProperty.call(icons, value);
      },
    },
  },

  computed: {
    iconComponent() {
      if (
        this.darkMode &&
        icons[this.name].props &&
        icons[this.name].props.darkMode
      ) {
        icons[this.name].props.darkMode.default = true;
      }
      return icons[this.name];
    },
  },
};
</script>
