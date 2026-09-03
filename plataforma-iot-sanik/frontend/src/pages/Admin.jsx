import { useState, useEffect } from 'react'
import Navbar from '../components/sanik/Navbar'
import { Shield, Plus, Users, Cpu } from 'lucide-react'

export default function Admin() {
  return (
    <div className="min-h-screen bg-[#0A0F0D]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield size={24} className="text-[#1D9E75]" />
          <div>
            <h1 className="text-white text-2xl font-bold">Panel de Administración</h1>
            <p className="text-[#8FA899] text-sm">Solo visible para el equipo de Sanik</p>
          </div>
        </div>

        <div className="bg-[#121A16] border border-[#1D9E75]/30 rounded-2xl p-8 text-center">
          <Shield size={40} className="text-[#1D9E75] mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Panel Admin en construcción</h2>
          <p className="text-[#8FA899] text-sm">Aquí irá la gestión de clientes, suscripciones y dispositivos.</p>
        </div>
      </main>
    </div>
  )
}
