// Browser bundle for validation: the engine + React Native Skia's own web implementation (JsiSkApi over CanvasKit),
// i.e. the exact `Skia` API the app calls on device.
import * as TwistRig from '../src';
// @ts-ignore — plain JS module from the app's node_modules
import { JsiSkApi } from '../../../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkia.js';
(window as any).TwistRig = TwistRig;
(window as any).JsiSkApi = JsiSkApi;
