import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

function initializeCarousels() {
  const cardCarousels = document.querySelectorAll('.card-carousel .swiper');
  const videoCarousels = document.querySelectorAll('.video-carousel .swiper');

  cardCarousels.forEach(element => {
    new Swiper(element, {
      modules: [Navigation],
      slidesPerView: 1,
      spaceBetween: 24,
      navigation: {
        prevEl: element.querySelector('.swiper-button-prev'),
        nextEl: element.querySelector('.swiper-button-next'),
      },
      breakpoints: {
        640: {
          slidesPerView: 2,
        },
        1024: {
          slidesPerView: 3,
        },
      },
    });
  });

  videoCarousels.forEach(element => {
    new Swiper(element, {
      modules: [Navigation],
      slidesPerView: 1,
      spaceBetween: 20,
      loop: true,
      centeredSlides: true,
      navigation: {
        prevEl: element.querySelector('.swiper-button-prev'),
        nextEl: element.querySelector('.swiper-button-next'),
      },
      breakpoints: {
        640: {
          slidesPerView: 1.5,
        },
        1024: {
          slidesPerView: 2,
        },
      },
    });
  });
}

// Initialize on page load
initializeCarousels();

// Initialize on view transitions
document.addEventListener('astro:page-load', initializeCarousels);