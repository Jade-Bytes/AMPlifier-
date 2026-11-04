import React from 'react';
import { AbsoluteFill, Composition } from 'remotion';
import { DURATION, FPS, HEIGHT, WIDTH } from './beats';
import { Trailer } from './Trailer';
import { AddressBar, Workspace } from './scenes/Devices';
import './theme';

/** Screen images for the 3D devices, rendered from the same workspace component. See scripts/screens.sh. */
const Wide: React.FC = () => <AbsoluteFill><Workspace layout="wide" /></AbsoluteFill>;
const Tall: React.FC = () => <AbsoluteFill><Workspace layout="tall" /></AbsoluteFill>;
const BrowserScreen: React.FC = () => (
  <AbsoluteFill style={{ background: '#080c1b' }}>
    <AddressBar text="jade-bytes.github.io/AMPlifier-/" />
    <div style={{ position: 'absolute', top: 70, left: 58, width: 1000, height: 600, transform: 'scale(.8833)', transformOrigin: 'top left' }}>
      <Workspace layout="wide" />
    </div>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="Trailer" component={Trailer} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="ScreenWide" component={Wide} durationInFrames={1} fps={FPS} width={1000} height={600} />
    <Composition id="ScreenTall" component={Tall} durationInFrames={1} fps={FPS} width={420} height={800} />
    <Composition id="ScreenBrowser" component={BrowserScreen} durationInFrames={1} fps={FPS} width={1000} height={600} />
  </>
);
