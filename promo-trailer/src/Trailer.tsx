import React from 'react';
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { CUE, DURATION } from './beats';
import { C } from './theme';
import { Signal, Tension } from './scenes/Opening';
import { ForecastPanel, GradebookPanel, PlanningPanel, ReportPanel, SimulatorPanel } from './scenes/Features';
import { Moment } from './scenes/Moment';
import { Android, Apple, Browser, Sync, Windows } from './scenes/Everywhere';
import { Close } from './scenes/Close';
import { World } from './world/World';

/** Every scene starts and ends on a beat constant, so an edit to the grid moves the whole picture. */
const Cut: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => (
  <Sequence from={from} durationInFrames={to - from}>{children}</Sequence>
);

/** For scenes whose timing is written against the whole trailer, so their frames stay absolute. */
const Absolute: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  return frame >= from && frame < to ? <>{children}</> : null;
};

export const Trailer: React.FC = () => (
  <AbsoluteFill style={{ background: C.bgDeep }}>
    <Audio src={staticFile('audio/mix.wav')} />
    <World />
    <Absolute from={0} to={CUE.signal}><Tension /></Absolute>
    <Absolute from={CUE.signal} to={CUE.rise}><Signal /></Absolute>
    <Cut from={CUE.rise} to={CUE.forecast}><SimulatorPanel /></Cut>
    <Cut from={CUE.forecast} to={CUE.reportCard}><ForecastPanel /></Cut>
    <Cut from={CUE.reportCard} to={CUE.gradebook}><ReportPanel /></Cut>
    <Cut from={CUE.gradebook} to={CUE.planning}><GradebookPanel /></Cut>
    <Cut from={CUE.planning} to={CUE.approach}><PlanningPanel /></Cut>
    <Absolute from={CUE.approach} to={CUE.everywhere}><Moment /></Absolute>
    <Cut from={CUE.android} to={CUE.windows}><Android /></Cut>
    <Cut from={CUE.windows} to={CUE.apple}><Windows /></Cut>
    <Cut from={CUE.apple} to={CUE.browser}><Apple /></Cut>
    <Cut from={CUE.browser} to={CUE.sync}><Browser /></Cut>
    <Cut from={CUE.sync} to={CUE.close}><Sync /></Cut>
    <Cut from={CUE.close} to={DURATION}><Close /></Cut>
  </AbsoluteFill>
);
