import React, { useState } from 'react';
import { HouseColor, Gender, EventType, Participant, EventLimitsConfig, SystemConfig, StudentRosterEntry } from '../types';
import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import {
  CompetitionGroup,
  activeEvents,
  activeHouses,
  eventMatchesGender,
  formatCompetitionGroupLabel,
  getEventCompetitionGroup,
  getHouseUi,
} from '../utils/systemConfig';

interface RegistrationFormProps {
  registrations: Record<string, Participant[]>; // Key: House_Year_Gender_EventId
  studentRoster?: StudentRosterEntry[];
  allowedHouse?: HouseColor;
  onUpdateRegistration: (key: string, participants: Participant[]) => void;
  eventLimits?: EventLimitsConfig;
  systemConfig?: SystemConfig;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ registrations, studentRoster = [], allowedHouse, onUpdateRegistration, eventLimits, systemConfig = DEFAULT_SYSTEM_CONFIG }) => {
  const houses = activeHouses(systemConfig).filter(house => !allowedHouse || house.id === allowedHouse);
  const [selectedHouse, setSelectedHouse] = useState<HouseColor>(allowedHouse || HouseColor.MERAH);
  const [selectedGroupKey, setSelectedGroupKey] = useState<number>(8);
  const [selectedGender, setSelectedGender] = useState<Gender>(Gender.LELAKI);
  const availableGroups = React.useMemo(() => {
    const groups = new Map<number, CompetitionGroup>();
    activeEvents(systemConfig)
      .filter(event => event.type !== EventType.KHUSUS)
      .forEach(event => {
        const group = getEventCompetitionGroup(event);
        groups.set(group.key, group);
      });

    const order = [8, 10, 12, 0];
    return Array.from(groups.values()).sort((a, b) => {
      const aIndex = order.indexOf(a.key);
      const bIndex = order.indexOf(b.key);
      if (aIndex >= 0 || bIndex >= 0) return (aIndex >= 0 ? aIndex : 99) - (bIndex >= 0 ? bIndex : 99);
      return a.key - b.key;
    });
  }, [systemConfig]);
  const selectedGroup = availableGroups.find(group => group.key === selectedGroupKey) || availableGroups[0];

  React.useEffect(() => {
    if (allowedHouse) {
      setSelectedHouse(allowedHouse);
      return;
    }
    if (!houses.some(house => house.id === selectedHouse)) {
      setSelectedHouse(houses[0]?.id || HouseColor.MERAH);
    }
  }, [allowedHouse, houses, selectedHouse]);

  React.useEffect(() => {
    if (availableGroups.length > 0 && !availableGroups.some(group => group.key === selectedGroupKey)) {
      setSelectedGroupKey(availableGroups[0].key);
    }
  }, [availableGroups, selectedGroupKey]);

  const currentEvents = activeEvents(systemConfig).filter(evt =>
    evt.type !== EventType.KHUSUS &&
    getEventCompetitionGroup(evt).key === selectedGroup?.key &&
    eventMatchesGender(evt, selectedGender)
  );
  const houseConfig = getHouseUi(systemConfig, selectedHouse);
  const rosterOptions = React.useMemo(() => {
    return studentRoster
      .filter(student => student.house === selectedHouse)
      .filter(student => !student.year || !selectedGroup || selectedGroup.years.includes(student.year))
      .filter(student => !student.gender || student.gender === selectedGender)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedGender, selectedGroup, selectedHouse, studentRoster]);

  // Helper to generate unique key for storage
  const getKey = (eventId: string) => `${selectedHouse}_${selectedGroup?.key || 0}_${selectedGender}_${eventId}`;

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

  const getRosterOptionLabel = (student: StudentRosterEntry) =>
    `${student.name} - ${student.className || 'Tiada kelas'}`;

  const handleRosterSearchChange = (eventId: string, index: number, value: string) => {
    if (!value) {
      handleParticipantChange(eventId, index, 'name', '');
      handleParticipantChange(eventId, index, 'className', '');
      return;
    }

    const normalizedValue = value.trim().toLowerCase();
    const selected = rosterOptions.find(student =>
      getRosterOptionLabel(student).trim().toLowerCase() === normalizedValue ||
      student.name.trim().toLowerCase() === normalizedValue
    );
    if (!selected) return;

    const key = getKey(eventId);
    const currentParticipants = registrations[key] || [];
    const newParticipants = [...currentParticipants];
    for (let i = 0; i <= index; i++) {
      if (!newParticipants[i]) newParticipants[i] = { name: '', className: '' };
    }
    newParticipants[index] = { name: selected.name, className: selected.className };
    onUpdateRegistration(key, newParticipants);
  };

  const getRosterSearchValue = (participant: Participant) => {
    if (!participant?.name) return '';
    const selected = rosterOptions.find(student =>
      student.name.trim().toLowerCase() === participant.name.trim().toLowerCase() &&
      student.className.trim().toLowerCase() === (participant.className || '').trim().toLowerCase()
    );
    return selected ? getRosterOptionLabel(selected) : '';
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6">
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
              {allowedHouse && (
                <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                  Akses guru dikunci kepada Rumah {getHouseUi(systemConfig, allowedHouse).name}.
                </div>
              )}
              <div className="flex space-x-2">
                {houses.map(({ id: house }) => (
                  <button
                    key={house}
                    onClick={() => setSelectedHouse(house)}
                    disabled={!!allowedHouse}
                    className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedHouse === house ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'border-transparent'
                    } ${HOUSE_CONFIG[house].color} ${allowedHouse ? 'cursor-not-allowed' : ''}`}
                    title={getHouseUi(systemConfig, house).name}
                  />
                ))}
              </div>
              <p className="mt-2 font-semibold text-gray-900">{getHouseUi(systemConfig, selectedHouse).name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tahun / Kategori</label>
              <div className="flex flex-wrap gap-2">
                {availableGroups.map((group) => (
                  <button
                    key={group.key}
                    onClick={() => setSelectedGroupKey(group.key)}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                      selectedGroup?.key === group.key
                        ? 'bg-slate-800 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {group.label}
                  </button>
                ))}
                {availableGroups.length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
                    Tiada acara aktif
                  </div>
                )}
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
        <div className="p-4 sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-700">
              Senarai Acara: {formatCompetitionGroupLabel(selectedGroup?.key || 0)} ({selectedGender === Gender.LELAKI ? 'Lelaki' : 'Perempuan'})
            </h3>
            <p className="text-sm text-gray-500">
              {selectedGroup && selectedGroup.years.every(year => year > 0)
                ? `Gabungan murid ${selectedGroup.years.map(year => `Tahun ${year}`).join(' dan ')} ikut rumah sukan.`
                : 'Masukkan nama peserta dan kelas.'}
            </p>
          </div>

          <div className="space-y-4 md:hidden">
            {currentEvents.map((event) => {
              const key = getKey(event.id);
              const currentParticipants = registrations[key] || [];
              const limit = eventLimits?.eventSlots?.[event.id] ?? event.maxParticipants;
              const slots = Array.from({ length: limit });

              return (
                <div key={event.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-black text-gray-900">{event.name}</div>
                        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                          {event.type === EventType.RELAY ? 'Relay' : 'Individu'} - {limit} slot
                        </div>
                      </div>
                      {event.type === EventType.RELAY && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black text-blue-800">
                          Relay
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 p-3">
                    {slots.map((_, index) => {
                      const participant = currentParticipants[index] || { name: '', className: '' };
                      return (
                        <div key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <label className="mb-2 block text-xs font-black uppercase tracking-wider text-gray-600">
                            {event.type === EventType.RELAY ? `Pelari ${index + 1}` : `Peserta ${index + 1}`}
                          </label>
                          {rosterOptions.length > 0 && (
                            <>
                            <input
                              key={`mobile-roster-${event.id}-${index}-${participant.name}-${participant.className}`}
                              type="search"
                              list={`mobile-roster-list-${event.id}-${index}`}
                              defaultValue={getRosterSearchValue(participant)}
                              placeholder="Taip / cari nama murid"
                              onChange={(e) => handleRosterSearchChange(event.id, index, e.target.value)}
                              className="mb-2 block w-full rounded-lg border border-blue-200 bg-blue-50 p-3 text-base font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            <datalist id={`mobile-roster-list-${event.id}-${index}`}>
                              {rosterOptions.map((student, studentIndex) => (
                                <option key={`${student.name}-${student.className}-${studentIndex}`} value={getRosterOptionLabel(student)} />
                              ))}
                            </datalist>
                            </>
                          )}
                          <input
                            type="text"
                            placeholder="Nama penuh peserta"
                            value={participant.name}
                            onChange={(e) => handleParticipantChange(event.id, index, 'name', e.target.value)}
                            className="mb-2 block w-full rounded-lg border border-gray-300 bg-white p-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                          <input
                            type="text"
                            placeholder="Kelas"
                            value={participant.className}
                            onChange={(e) => handleParticipantChange(event.id, index, 'className', e.target.value)}
                            className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                                  {rosterOptions.length > 0 && (
                                    <>
                                    <input
                                      key={`desktop-roster-${event.id}-${index}-${participant.name}-${participant.className}`}
                                      type="search"
                                      list={`desktop-roster-list-${event.id}-${index}`}
                                      defaultValue={getRosterSearchValue(participant)}
                                      placeholder="Taip / cari murid"
                                      onChange={(e) => handleRosterSearchChange(event.id, index, e.target.value)}
                                      className="focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm text-xs border-blue-200 bg-blue-50 rounded-md p-1.5 border mb-1 font-semibold text-slate-700"
                                    />
                                    <datalist id={`desktop-roster-list-${event.id}-${index}`}>
                                      {rosterOptions.map((student, studentIndex) => (
                                        <option key={`${student.name}-${student.className}-${studentIndex}`} value={getRosterOptionLabel(student)} />
                                      ))}
                                    </datalist>
                                    </>
                                  )}
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
