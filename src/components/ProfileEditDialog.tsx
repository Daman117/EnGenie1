import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { deleteStandardsDocument, listStandardsDocuments, reindexStandardsDocument, StandardsDocumentRecord, updateProfile, uploadStandardsDocument } from "@/components/AIRecommender/api";
import { useToast } from "@/components/ui/use-toast";
import { Upload } from "lucide-react";

interface ProfileEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileEditDialog({ open, onOpenChange }: ProfileEditDialogProps) {
    const { user, refreshUser } = useAuth();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUsername] = useState("");

    // New fields
    const [companyName, setCompanyName] = useState("");
    const [location, setLocation] = useState("");
    const [strategy, setStrategy] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [standardsDocs, setStandardsDocs] = useState<StandardsDocumentRecord[]>([]);
    const [isStandardsLoading, setIsStandardsLoading] = useState(false);
    const [standardsUploadFile, setStandardsUploadFile] = useState<File | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Reset form when dialog opens or user changes
    useEffect(() => {
        if (open && user) {
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            setUsername(user.username || "");
            setCompanyName(user.companyName || "");
            setLocation(user.location || "");
            setStrategy(user.strategyInterest || "");
            setStandardsUploadFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [open, user]);

    useEffect(() => {
        const loadStandards = async () => {
            if (!open) return;
            setIsStandardsLoading(true);
            try {
                const docs = await listStandardsDocuments();
                setStandardsDocs(docs);
            } catch (e: any) {
                toast({
                    title: "Error",
                    description: e.message || "Failed to load standards documents",
                    variant: "destructive",
                });
            } finally {
                setIsStandardsLoading(false);
            }
        };
        loadStandards();
    }, [open, toast]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setStandardsUploadFile(e.target.files[0]);
        }
    };

    const removeFile = () => {
        setStandardsUploadFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const handleStandardsUpload = async () => {
        if (!standardsUploadFile) return;
        setIsStandardsLoading(true);
        try {
            await uploadStandardsDocument(standardsUploadFile);
            toast({
                title: "Uploaded",
                description: "Standards document uploaded and indexed.",
            });
            removeFile();
            const docs = await listStandardsDocuments();
            setStandardsDocs(docs);
        } catch (e: any) {
            toast({
                title: "Error",
                description: e.message || "Failed to upload standards document",
                variant: "destructive",
            });
        } finally {
            setIsStandardsLoading(false);
        }
    };

    const handleStandardsDelete = async (documentId: string) => {
        setIsStandardsLoading(true);
        try {
            await deleteStandardsDocument(documentId);
            const docs = await listStandardsDocuments();
            setStandardsDocs(docs);
            toast({ title: "Deleted", description: "Standards document removed." });
        } catch (e: any) {
            toast({ title: "Error", description: e.message || "Delete failed", variant: "destructive" });
        } finally {
            setIsStandardsLoading(false);
        }
    };

    const handleStandardsReindex = async (documentId: string) => {
        setIsStandardsLoading(true);
        try {
            await reindexStandardsDocument(documentId);
            const docs = await listStandardsDocuments();
            setStandardsDocs(docs);
            toast({ title: "Reindexed", description: "Standards document reprocessed." });
        } catch (e: any) {
            toast({ title: "Error", description: e.message || "Reindex failed", variant: "destructive" });
        } finally {
            setIsStandardsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('first_name', firstName);
            formData.append('last_name', lastName);
            formData.append('username', username);
            formData.append('company_name', companyName);
            formData.append('location', location);
            formData.append('strategy_interest', strategy);

            // Using 'any' cast as API expects specific object shape but backend supports FormData
            await updateProfile(formData as any);

            toast({
                title: "Profile Updated",
                description: "Your profile has been successfully updated.",
            });

            // Refresh user data in AuthContext without reloading the page
            await refreshUser();

        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to update profile",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] rounded-xl bg-gradient-to-br from-[#F5FAFC]/90 to-[#EAF6FB]/90 dark:from-slate-900/90 dark:to-slate-900/50 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl transition-all duration-300 ease-in-out hover:scale-105 [&>button]:transition-all [&>button]:duration-200 [&>button]:hover:scale-[1.35] [&>button]:!top-6 [&>button]:!right-5 max-h-[90vh] overflow-y-auto custom-no-scrollbar">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-[#0F6CBD] dark:text-sky-300">Edit Profile</DialogTitle>
                    <DialogDescription className="text-muted-foreground/80">
                        Update your personal information here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-6 py-6">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="username" className="text-center font-semibold text-[#0F6CBD] dark:text-sky-300">
                                Username
                            </Label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="col-span-3 bg-white/50 dark:bg-slate-800/40 border-white/30 dark:border-slate-700/50 focus:border-[#0F6CBD] focus:ring-[#0F6CBD]/20 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                                placeholder="Enter username"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="firstName" className="text-center font-semibold text-[#0F6CBD] dark:text-sky-300">
                                First Name
                            </Label>
                            <Input
                                id="firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="col-span-3 bg-white/50 dark:bg-slate-800/40 border-white/30 dark:border-slate-700/50 focus:border-[#0F6CBD] focus:ring-[#0F6CBD]/20 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                                placeholder="Enter first name"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="lastName" className="text-center font-semibold text-[#0F6CBD] dark:text-sky-300">
                                Last Name
                            </Label>
                            <Input
                                id="lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="col-span-3 bg-white/50 dark:bg-slate-800/40 border-white/30 dark:border-slate-700/50 focus:border-[#0F6CBD] focus:ring-[#0F6CBD]/20 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                                placeholder="Enter last name"
                            />
                        </div>

                        {/* New Fields */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="companyName" className="text-center font-semibold text-[#0F6CBD] dark:text-sky-300">
                                Company
                            </Label>
                            <Input
                                id="companyName"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="col-span-3 bg-white/50 dark:bg-slate-800/40 border-white/30 dark:border-slate-700/50 focus:border-[#0F6CBD] focus:ring-[#0F6CBD]/20 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                                placeholder="Company Name"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="location" className="text-center font-semibold text-[#0F6CBD] dark:text-sky-300">
                                Location
                            </Label>
                            <Input
                                id="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="col-span-3 bg-white/50 dark:bg-slate-800/40 border-white/30 dark:border-slate-700/50 focus:border-[#0F6CBD] focus:ring-[#0F6CBD]/20 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                                placeholder="Location"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="strategy" className="text-center font-semibold text-[#0F6CBD] dark:text-sky-300 pt-3">
                                Strategy
                            </Label>
                            <div className="col-span-3 space-y-2">
                                <div className="relative hover:scale-[1.02] transition-all duration-300">
                                    <Input
                                        id="strategy"
                                        value={strategy}
                                        onChange={(e) => setStrategy(e.target.value)}
                                        className="bg-white/50 dark:bg-slate-800/40 border-white/30 dark:border-slate-700/50 focus:border-[#0F6CBD] focus:ring-[#0F6CBD]/20 rounded-xl transition-all duration-200 hover:scale-100 pr-12"
                                        placeholder="Strategy (Optional)"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors hover:bg-transparent transition-transform hover:scale-110 active:scale-95"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Upload Standards Document"
                                    >
                                        <Upload className={`h-4 w-4 ${standardsUploadFile ? "text-primary" : ""}`} />
                                    </Button>
                                    <Input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                                {standardsUploadFile && (
                                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                        <span>File: {standardsUploadFile.name}</span>
                                        <div className="flex items-center gap-3">
                                            <button type="button" onClick={removeFile} className="text-red-500 hover:text-red-700">Remove</button>
                                            <button type="button" onClick={handleStandardsUpload} className="text-[#0F6CBD] hover:text-[#064375]" disabled={isStandardsLoading}>Upload</button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground px-1">
                                        {isStandardsLoading ? "Loading standards..." : "Standards documents"}
                                    </div>
                                    <div className="space-y-1">
                                        {standardsDocs.length === 0 && !isStandardsLoading && (
                                            <div className="text-xs text-muted-foreground px-1">No standards uploaded</div>
                                        )}
                                        {standardsDocs.slice(0, 5).map((d) => (
                                            <div key={d.documentId} className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                                <span className="truncate max-w-[210px]">{d.filename}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase tracking-wide">{d.status}</span>
                                                    <button type="button" className="text-[#0F6CBD] hover:text-[#064375]" onClick={() => handleStandardsReindex(d.documentId)} disabled={isStandardsLoading}>Reindex</button>
                                                    <button type="button" className="text-red-500 hover:text-red-700" onClick={() => handleStandardsDelete(d.documentId)} disabled={isStandardsLoading}>Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="rounded-xl border-white/30 bg-white/20 hover:bg-white/40 dark:bg-slate-800/40 dark:hover:bg-slate-800/60 transition-all shadow-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="rounded-xl bg-[#2B95D6] hover:bg-[#064375] text-white font-semibold border border-white/30 transition-all duration-300 px-6 hover:scale-[1.02] active:scale-[0.98] shadow-none"
                        >
                            {isLoading ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
