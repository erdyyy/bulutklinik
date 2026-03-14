import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { appointmentApi } from '../../services/appointmentApi';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

export function BookAppointmentPage() {
  const navigate = useNavigate();
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', doctorId, date],
    queryFn: () => appointmentApi.getSlots(doctorId, date),
    enabled: !!doctorId && !!date,
  });

  const book = useMutation({
    mutationFn: () => appointmentApi.create({
      doctorId,
      appointmentDate: date,
      startTime: selectedSlot,
      type: 'InPerson',
    }),
    onSuccess: () => navigate('/my-appointments'),
  });

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Randevu Al</h1>

      <div className="space-y-4 bg-white rounded-lg shadow p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doktor ID</label>
          <input
            value={doctorId} onChange={e => setDoctorId(e.target.value)}
            placeholder="Doktor UUID giriniz"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            min={dayjs().format('YYYY-MM-DD')}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {slotsLoading && <p className="text-gray-500 text-sm">Slotlar yükleniyor...</p>}

        {slotsData?.slots && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Uygun Saatler</p>
            <div className="grid grid-cols-4 gap-2">
              {slotsData.slots.map((s: any) => (
                <button
                  key={s.startTime}
                  disabled={!s.isAvailable}
                  onClick={() => setSelectedSlot(s.startTime)}
                  className={`py-1 rounded text-sm border ${
                    selectedSlot === s.startTime
                      ? 'bg-blue-600 text-white border-blue-600'
                      : s.isAvailable
                      ? 'bg-white hover:bg-blue-50 border-gray-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-100'
                  }`}
                >
                  {s.startTime.slice(0, 5)}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          disabled={!selectedSlot || book.isPending}
          onClick={() => book.mutate()}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {book.isPending ? 'Kaydediliyor...' : 'Randevu Onayla'}
        </button>
        {book.isError && <p className="text-red-500 text-sm">Randevu oluşturulamadı.</p>}
      </div>
    </div>
  );
}
