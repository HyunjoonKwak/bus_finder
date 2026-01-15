/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-explicit-any */

declare namespace kakao {
  namespace maps {
    class Map {
      constructor(container: HTMLElement, options: { center: LatLng; level: number });
      setCenter(position: LatLng): void;
      getCenter(): LatLng;
      setLevel(level: number): void;
      getLevel(): number;
      setBounds(bounds: LatLngBounds): void;
      panTo(position: LatLng): void;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class LatLngBounds {
      constructor();
      extend(position: LatLng): void;
    }

    class CustomOverlay {
      constructor(options: {
        position: LatLng;
        content: string | HTMLElement;
        map?: Map;
        yAnchor?: number;
        xAnchor?: number;
        zIndex?: number;
      });
      setMap(map: Map | null): void;
    }

    class Circle {
      constructor(options: any);
      setMap(map: Map | null): void;
    }

    class Polyline {
      constructor(options: any);
      setMap(map: Map | null): void;
    }

    class MarkerImage {
      constructor(src: string, size: Size);
    }

    class Size {
      constructor(width: number, height: number);
    }

    namespace event {
      function addListener(target: Map, type: string, handler: () => void): void;
      function removeListener(target: Map, type: string, handler: () => void): void;
    }

    namespace services {
      class Places {
        constructor(map?: Map);
        categorySearch(
          code: string,
          callback: (data: any[], status: string) => void,
          options?: { useMapBounds?: boolean; size?: number }
        ): void;
        keywordSearch(
          keyword: string,
          callback: (data: any[], status: string) => void,
          options?: { size?: number }
        ): void;
      }

      class Geocoder {
        addressSearch(address: string, callback: (result: any[], status: string) => void): void;
      }

      const Status: {
        OK: string;
        ZERO_RESULT: string;
        ERROR: string;
      };
    }
  }
}

interface Window {
  kakao: {
    maps: typeof kakao.maps;
  };
}
