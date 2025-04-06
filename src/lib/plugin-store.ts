import { create } from 'zustand'
import SideCards from '@/main';
import { TFile } from 'obsidian';

type PluginStoreState = {
  plugin: SideCards;
  dataFile: TFile;
  currentFile?: TFile;
}

export const usePluginStore = create<PluginStoreState>()(() => ({
  plugin: {} as SideCards,
  dataFile: {} as TFile,
}));
