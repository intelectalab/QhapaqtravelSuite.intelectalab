import { Fraunces, Lora, Nunito } from "next/font/google";

const lora = Lora({ variable: "--font-site-lora", subsets: ["latin"], preload: false });
const nunito = Nunito({ variable: "--font-site-nunito", subsets: ["latin"], preload: false });
const fraunces = Fraunces({ variable: "--font-site-fraunces", subsets: ["latin"], preload: false });

export const SITE_FONT_VARIABLES = `${lora.variable} ${nunito.variable} ${fraunces.variable}`;
