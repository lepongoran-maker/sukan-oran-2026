import React, { useState } from 'react';
import { HouseColor, Gender, EventType, Participant, EventLimitsConfig, SystemConfig } from '../types';
import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import { activeHouses, eventsForYear, getHouseUi } from '../utils/systemConfig';

interface RegistrationFormProps {
  registrations: Record<string, Participant[]>; // Key: House_Year_Gender_EventId
  onUpdateRegistration: (key: string, participants: Participant[]) => void;
  eventLimits?: EventLimitsConfig;
  systemConfig?: SystemConfig;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ registrations, onUpdateRegistration, eventLimits, systemConfig = DEFAULT_SYSTEM_CONFIG }) => {
  const houses = activeHouses(systemConfig);
  const [selectedHouse, setSelectedHouse] = useState<HouseColor>(HouseColor.MERAH);
  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [selectedGender, setSelectedGender] = useState<Gender>(Gender.LELAKI);

  React.useEffect(() => {
    if (!houses.some(house => house.id === selectedHouse)) {
      setSelectedHouse(houses[0]?.id || HouseColor.MERAH);
    }
  }, [houses, selectedHouse]);

  const unfilteredEvents = eventsForYear(systemConfig, selectedYear);
  const currentEvents = unfilteredEvents.filter(evt => !evt.id.startsWith('sk_'));
  const houseConfig = getHouseUi(systemConfig, selectedHouse);

  // Helper to generate unique key for storage
  const getKey = (eventId: string) => `${selectedHouse}_${selectedYear}_${selectedGender}_${eventId}`;

  const handleParticipantChange = (eventId: string, index: number, field: keyof Participant, value: string) => {
    const key = getKey(eventId);
    const currentParticipants = registrations[key] || [];
    
    // Create deep copy to avoid mutation issues
    const newParticipants = [...currentParticipants];
    
    // Ensure all previous indexes are filled with empty objects instead of undefined
    // Firebase will reject arrays containing undefined values
    for (let i = 0; i <= index; i++) {
      if (!newParticipants[i]) {
        newParticipants[i] = { name: '', className: '' };
      }
    }
    
    newParticipants[index] = { ...newParticipants[index] };
    newParticipants[index][field] = value;
    
    onUpdateRegistration(key, newParticipants);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header Config */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
            <span className={`w-4 h-8 mr-3 rounded ${houseConfig.color}`}></span>
            Pendaftaran Peserta
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Rumah Sukan</label>
              <div className="flex space-x-2">
                {houses.map(({ id: house }) => (
                  <button
                    key={house}
                    onClick={() => setSelectedHouse(house)}
                    className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedHouse === house ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'border-transparent'
                    } ${HOUSE_CONFIG[house].color}`}
                    title={getHouseUi(systemConfig, house).name}
                  />
                ))}
              </div>
              <p className="mt-2 font-semibold text-gray-900">{getHouseUi(systemConfig, selectedHouse).name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tahun / Kategori</label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                      selectedYear === year
                        ? 'bg-slate-800 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Tahun {year}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jantina</label>
              <div className="flex flex-wrap gap-2">
                {[Gender.LELAKI, Gender.PEREMPUAN].map((gender) => (
                  <button
                    key={gender}
                    onClick={() => setSelectedGender(gender)}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                      selectedGender === gender
                        ? 'bg-slate-800 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {gender === Gender.LELAKI ? 'Lelaki' : 'Perempuan'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Input Grid */}
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-700">
              Senarai Acara: Tahun {selectedYear} ({selectedGender === Gender.LELAKI ? 'Lelaki' : 'Perempuan'})
            </h3>
            <p className="text-sm text-gray-500">Masukkan nama peserta dan kelas.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-32 md:w-40">
                    Acara
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Peserta
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentEvents.map((event) => {
                  const key = getKey(event.id);
                  const currentParticipants = registrations[key] || [];
                  const limit = eventLimits?.eventSlots?.[event.id] ?? event.maxParticipants;
                  const slots = Array.from({ length: limit });

                  return (
                    <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-100 bg-gray-50 align-top">
                        <div className="flex flex-col gap-1">
                          <span>{event.name}</span>
                          {event.type === EventType.RELAY && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 w-fit">Relay</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`grid grid-cols-1 gap-3 ${event.type === EventType.RELAY ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                          {slots.map((_, index) => {
                             const participant = currentParticipants[index] || { name: '', className: '' };
                             return (
                                <div key={index} className="flex flex-col space-y-1 bg-gray-50 p-2 rounded border border-gray-200">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                    {event.type === EventType.RELAY ? `Pelari ${index + 1}` : `Peserta ${index + 1}`}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Nama"
                                    value={participant.name}
                                    onChange={(e) => handleParticipantChange(event.id, index, 'name', e.target.value)}
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm text-xs border-gray-300 rounded-md p-1.5 border mb-1"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Kelas"
                                    value={participant.className}
                                    onChange={(e) => handleParticipantChange(event.id, index, 'className', e.target.value)}
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm text-xs border-gray-300 rounded-md p-1.5 border"
                                  />
                                </div>
                             );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;
