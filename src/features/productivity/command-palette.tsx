"use client";
import { Command, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const actions=[
  {id:"top",label:"Kembali ke atas",run:()=>window.scrollTo({top:0,behavior:"smooth"})},
  {id:"notifications",label:"Buka notifikasi",run:()=>window.dispatchEvent(new CustomEvent("arus:open-notifications"))},
  {id:"theme",label:"Ganti tema tampilan",run:()=>window.dispatchEvent(new CustomEvent("arus:toggle-theme"))},
];
export function CommandPalette(){const [open,setOpen]=useState(false);const [query,setQuery]=useState("");useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setOpen(true)}if(event.key==="Escape")setOpen(false)};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[]);const filtered=useMemo(()=>actions.filter(action=>action.label.toLowerCase().includes(query.toLowerCase())),[query]);if(!open)return <button className="command-palette-hint" aria-label="Buka command palette" onClick={()=>setOpen(true)}><Command size={15}/><span>⌘ K</span></button>;return <div className="command-palette-backdrop" role="presentation" onMouseDown={()=>setOpen(false)}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={event=>event.stopPropagation()}><div className="command-palette-search"><Search size={18}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari aksi…"/><button aria-label="Tutup" onClick={()=>setOpen(false)}><X size={17}/></button></div><div className="command-palette-list">{filtered.length?filtered.map(action=><button key={action.id} onClick={()=>{action.run();setOpen(false)}}>{action.label}<span>↵</span></button>):<p>Tidak ada aksi yang cocok.</p>}</div></section></div>}
