"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getAllSheds, getAllParties, getAllFeedItems } from "@/lib/api";
import type { Shed, Party, FeedItem } from "@/lib/types";

interface AppDataContextType {
  sheds: Shed[];
  parties: Party[];
  feedItems: FeedItem[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFromStorage = () => {
    const storedSheds = localStorage.getItem("sheds");
    const storedParties = localStorage.getItem("parties");
    const storedFeedItems = localStorage.getItem("feedItems");

    if (storedSheds) setSheds(JSON.parse(storedSheds));
    if (storedParties) setParties(JSON.parse(storedParties));
    if (storedFeedItems) setFeedItems(JSON.parse(storedFeedItems));
  };

  const saveToStorage = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const fetchData = async () => {
    try {
      const [shedsData, partiesData, feedItemsData] = await Promise.all([
        getAllSheds(),
        getAllParties(),
        getAllFeedItems(),
      ]);

      setSheds(shedsData);
      setParties(partiesData);
      setFeedItems(feedItemsData);

      saveToStorage("sheds", shedsData);
      saveToStorage("parties", partiesData);
      saveToStorage("feedItems", feedItemsData);
    } catch (error) {
      console.error("Failed to fetch app data:", error);
      // Load from storage if fetch fails
      loadFromStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    await fetchData();
  };

  useEffect(() => {
    // Load from storage first for immediate display
    loadFromStorage();
    // Then fetch fresh data
    fetchData();
  }, []);

  return (
    <AppDataContext.Provider
      value={{ sheds, parties, feedItems, isLoading, refreshData }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error("useAppData must be used within an AppDataProvider");
  }
  return context;
}
