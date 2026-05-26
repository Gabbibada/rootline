/**
 * DatePickerField
 *
 * A form field that opens a native date picker.
 * - Android: calendar dialog (native)
 * - iOS: spinner inside a slide-up modal
 *
 * Internal value format : YYYY-MM-DD  (matches Supabase / engine)
 * Display format        : DD-MM-YYYY  (user-facing)
 */
import { useState } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet, Platform,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Colors, Typography, Spacing, Radius } from '../theme'

// ── Date helpers (exported so screens can reuse displayDate) ──────────────────

/** Parse YYYY-MM-DD → JS Date (noon local time avoids DST edge cases) */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

/** JS Date → YYYY-MM-DD */
function dateToISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** YYYY-MM-DD → DD-MM-YYYY (for display in read views) */
export function displayDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

// ── Component ─────────────────────────────────────────────────────────────────

// Earliest date the picker allows — ancestors can go well before 1970
const MIN_DATE = new Date(1900, 0, 1)

interface DatePickerFieldProps {
  value:        string | null
  onChange:     (iso: string | null) => void
  placeholder?: string
  maxDate?:     Date
  minDate?:     Date
}

export function DatePickerField({
  value,
  onChange,
  placeholder = 'DD-MM-YYYY',
  maxDate,
  minDate = MIN_DATE,
}: DatePickerFieldProps) {
  const [show,        setShow]        = useState(false)
  const [pendingDate, setPendingDate] = useState<Date>(new Date())

  const displayed   = value ? displayDate(value) : null
  const currentDate = value ? isoToDate(value) : new Date()

  // ── Android ────────────────────────────────────────────────────────────────
  if (Platform.OS === 'android') {
    const handleAndroid = (_event: DateTimePickerEvent, selected?: Date) => {
      setShow(false)
      if (selected) onChange(dateToISO(selected))
    }

    return (
      <>
        <Pressable
          style={s.field}
          onPress={() => setShow(true)}
        >
          <Text style={displayed ? s.fieldText : s.placeholder}>
            {displayed ?? placeholder}
          </Text>
          <Text style={s.icon}>📅</Text>
        </Pressable>

        {show && (
          <DateTimePicker
            value={currentDate}
            mode="date"
            display="default"
            onChange={handleAndroid}
            maximumDate={maxDate}
            minimumDate={minDate}
          />
        )}
      </>
    )
  }

  // ── iOS — spinner in a modal ───────────────────────────────────────────────
  const openPicker = () => {
    setPendingDate(currentDate)
    setShow(true)
  }

  const handleiOS = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setPendingDate(selected)
  }

  const confirm = () => {
    onChange(dateToISO(pendingDate))
    setShow(false)
  }

  const clear = () => {
    onChange(null)
    setShow(false)
  }

  return (
    <>
      <Pressable style={s.field} onPress={openPicker}>
        <Text style={displayed ? s.fieldText : s.placeholder}>
          {displayed ?? placeholder}
        </Text>
        <Text style={s.icon}>📅</Text>
      </Pressable>

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShow(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Pressable onPress={clear} hitSlop={12}>
                <Text style={s.clearBtn}>Clear</Text>
              </Pressable>
              <Text style={s.sheetTitle}>Select date</Text>
              <Pressable onPress={confirm} hitSlop={12}>
                <Text style={s.doneBtn}>Done</Text>
              </Pressable>
            </View>

            <DateTimePicker
              value={pendingDate}
              mode="date"
              display="spinner"
              onChange={handleiOS}
              maximumDate={maxDate}
              minimumDate={minDate}
              style={s.spinner}
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  field: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cream2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
  fieldText:   { ...Typography.body, color: Colors.textDark, flex: 1 },
  placeholder: { ...Typography.body, color: Colors.textMuted, flex: 1 },
  icon:        { fontSize: 16 },

  // Modal
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,16,8,0.45)' },
  sheet:       { backgroundColor: Colors.cream, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingBottom: Spacing.xxxl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  sheetTitle:  { ...Typography.heading2, color: Colors.textDark },
  clearBtn:    { ...Typography.body, color: Colors.textMuted, minWidth: 48 },
  doneBtn:     { ...Typography.label, color: Colors.amber, fontSize: 15, minWidth: 48, textAlign: 'right' },
  spinner:     { width: '100%' },
})
