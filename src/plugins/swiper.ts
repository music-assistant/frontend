import { Swiper, SwiperSlide } from "swiper/vue";
import SwiperCore from "swiper";
import { Navigation, Pagination, FreeMode, Mousewheel } from "swiper/modules";
import { App } from "vue";
import "./swiper.css";

export default {
  install(app: App) {
    SwiperCore.use([Pagination, Navigation, FreeMode, Mousewheel]);
    app.component("Swiper", Swiper).component("SwiperSlide", SwiperSlide);
  },
};
