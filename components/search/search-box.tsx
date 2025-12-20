"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

interface SearchBoxProps {
  className?: string
  placeholder?: string
  showSuggestions?: boolean
  autoFocus?: boolean
}

export function SearchBox({
  className,
  placeholder = "搜索新闻...",
  showSuggestions = true,
  autoFocus = false,
}: SearchBoxProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get("q") || "")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestionsList, setShowSuggestionsList] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    const currentQuery = searchParams.get("q") || ""
    setQuery(currentQuery)
  }, [searchParams])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestionsList(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleSearch = (searchQuery?: string) => {
    const searchTerm = searchQuery || query.trim()
    if (searchTerm.length === 0) return

    router.push(`/search?q=${encodeURIComponent(searchTerm)}`)
    setShowSuggestionsList(false)
  }

  const handleInputChange = async (value: string) => {
    setQuery(value)

    if (showSuggestions && value.trim().length >= 2) {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(value.trim())}&limit=5`
        )
        const data = await res.json()
        if (data.success) {
          setSuggestions(data.data)
          setShowSuggestionsList(true)
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error)
      } finally {
        setLoading(false)
      }
    } else {
      setSuggestions([])
      setShowSuggestionsList(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    } else if (e.key === "Escape") {
      setShowSuggestionsList(false)
      inputRef.current?.blur()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    handleSearch(suggestion)
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestionsList(true)
            }
          }}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 h-7 w-7 p-0"
            onClick={() => {
              setQuery("")
              inputRef.current?.focus()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showSuggestionsList && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md"
        >
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="flex items-center gap-2">
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <span>{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

