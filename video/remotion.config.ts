// Remotion CLI settings for the Lookup film. The aurora is a WebGL shader, so headless Chrome needs a
// GL backend; ANGLE uses the GPU on macOS.
import { Config } from "@remotion/cli/config";

Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(14);
Config.setConcurrency(6);
Config.setEntryPoint("src/index.ts");
