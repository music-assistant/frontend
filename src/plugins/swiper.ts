import { Swiper, SwiperSlide } from "swiper/vue";
import SwiperCore from "swiper";
import { Navigation, Pagination, FreeMode, Mousewheel } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/mousewheel";
import "swiper/swiper-bundle.css";
import { App } from "vue";

export default {
  install(app: App) {
    SwiperCore.use([Pagination, Navigation, FreeMode, Mousewheel]);
    app.component("Swiper", Swiper).component("SwiperSlide", SwiperSlide);
  },
};
