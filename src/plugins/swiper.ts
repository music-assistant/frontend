import { Swiper, SwiperSlide } from "swiper/vue";
import SwiperCore from "swiper";
import { Navigation, Pagination, FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/swiper-bundle.css";
import { App } from "vue";

export default {
  install(app: App) {
    SwiperCore.use([Pagination, Navigation, FreeMode]);
    app.component("Swiper", Swiper).component("SwiperSlide", SwiperSlide);
  },
};
